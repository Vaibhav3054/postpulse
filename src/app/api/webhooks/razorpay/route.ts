import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/billing/razorpay";
import {
  activateVerifiedPaidSubscription,
  ensureCanonicalPlans,
  recordFailedPayment,
  recordRefundProcessed,
  syncUserWorkspacesPlan,
} from "@/lib/billing/subscription-service";

/**
 * POST /api/webhooks/razorpay
 *
 * Authoritative Razorpay Webhook Handler:
 *  - Verifies HMAC-SHA256 `x-razorpay-signature` over the raw request body.
 *  - Deduplicates events via unique `WebhookEvent.eventId` to prevent double processing.
 *  - Handles activation, renewal (`subscription.charged`), failure, cancellation, expiry, and refunds.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    account_id?: string;
    payload?: {
      subscription?: {
        entity?: {
          id: string;
          plan_id?: string;
          customer_id?: string;
          status?: string;
          current_start?: number;
          current_end?: number;
          notes?: Record<string, string>;
        };
      };
      payment?: {
        entity?: {
          id: string;
          amount: number;
          currency?: string;
          status?: string;
          order_id?: string;
          invoice_id?: string;
          error_description?: string;
          notes?: Record<string, string>;
        };
      };
      refund?: {
        entity?: {
          id: string;
          payment_id: string;
          amount: number;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON webhook payload" }, { status: 400 });
  }

  const eventType = payload.event || "unknown";
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const eventId =
    req.headers.get("x-razorpay-event-id")?.trim() || `rzp_${eventType}_${payloadHash.slice(0, 24)}`;

  // Idempotency guard: reject duplicate webhook deliveries cleanly with HTTP 200
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "razorpay",
        eventId,
        eventType,
        payloadHash,
      },
    });
  } catch (err: unknown) {
    // Prisma unique constraint error P2002 => already processed
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true, eventId });
    }
    throw err;
  }

  const subEntity = payload.payload?.subscription?.entity;
  const payEntity = payload.payload?.payment?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  try {
    switch (eventType) {
      case "subscription.authenticated":
      case "subscription.activated":
      case "subscription.charged": {
        if (!subEntity?.id) break;

        const existingSub = await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: subEntity.id },
          include: { plan: true },
        });

        const userId = existingSub?.userId || subEntity.notes?.userId;
        const planCode = existingSub?.plan.code || subEntity.notes?.planCode || "pro";
        const billingInterval =
          existingSub?.billingInterval === "ANNUAL" ||
          subEntity.notes?.billingInterval === "ANNUAL"
            ? "ANNUAL"
            : "MONTHLY";

        if (userId) {
          await activateVerifiedPaidSubscription({
            userId,
            planCode,
            billingInterval,
            razorpaySubscriptionId: subEntity.id,
            razorpayPaymentId: payEntity?.id,
            razorpayOrderId: payEntity?.order_id,
            razorpayCustomerId: subEntity.customer_id,
            razorpayInvoiceId: payEntity?.invoice_id,
            razorpayPlanId: subEntity.plan_id,
            amountPaise: payEntity?.amount ?? 0,
            currency: payEntity?.currency || "INR",
            periodStart: subEntity.current_start
              ? new Date(subEntity.current_start * 1000)
              : undefined,
            periodEnd: subEntity.current_end ? new Date(subEntity.current_end * 1000) : undefined,
            metadata: { lastWebhookEvent: eventType, eventId },
          });
        }
        break;
      }

      case "subscription.pending":
      case "subscription.halted": {
        if (!subEntity?.id) break;
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId: subEntity.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        if (!subEntity?.id) break;
        const existingSub = await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: subEntity.id },
        });
        if (existingSub) {
          const now = new Date();
          const newStatus =
            eventType === "subscription.completed"
              ? SubscriptionStatus.EXPIRED
              : SubscriptionStatus.CANCELLED;

          await prisma.subscription.update({
            where: { id: existingSub.id },
            data: {
              status: newStatus,
              cancelledAt: existingSub.cancelledAt || now,
              endedAt: now,
            },
          });

          await ensureCanonicalPlans();
          const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });
          if (freePlan) {
            await syncUserWorkspacesPlan(existingSub.userId, freePlan.id);
          }
        }
        break;
      }

      case "payment.failed": {
        if (!payEntity) break;
        await recordFailedPayment({
          userId: payEntity.notes?.userId,
          razorpaySubscriptionId: subEntity?.id || payEntity.notes?.razorpaySubscriptionId,
          razorpayPaymentId: payEntity.id,
          amountPaise: payEntity.amount || 0,
          planCode: payEntity.notes?.planCode,
          failureReason: payEntity.error_description || "Payment failed at Razorpay gateway",
        });
        break;
      }

      case "refund.processed": {
        if (!refundEntity?.payment_id) break;
        await recordRefundProcessed({
          razorpayPaymentId: refundEntity.payment_id,
          refundAmountPaise: refundEntity.amount,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true, eventId, eventType });
  } catch (err: unknown) {
    console.error("[Razorpay Webhook Error]", eventType, err);
    return NextResponse.json(
      { error: (err as Error).message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
