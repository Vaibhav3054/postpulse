import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  fetchRazorpayPayment,
  fetchRazorpaySubscription,
  getRazorpayConfig,
  verifyRazorpayPaymentSignature,
} from "@/lib/billing/razorpay";
import { activateVerifiedPaidSubscription } from "@/lib/billing/subscription-service";

const verifySchema = z.object({
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_subscription_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

/**
 * POST /api/billing/verify
 * Verifies Razorpay Checkout signature on the backend AND cross-checks live payment status
 * with Razorpay API before activating the customer's subscription.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, verifySchema);
  if (parsed.error) return parsed.error;

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = parsed.data;

  const rzConfig = getRazorpayConfig();
  if (!rzConfig.isConfigured) {
    return NextResponse.json(
      { error: "Razorpay credentials are not configured.", code: "RAZORPAY_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  // 1. Strict Backend HMAC-SHA256 Signature Verification
  const isSignatureValid = verifyRazorpayPaymentSignature({
    razorpayPaymentId: razorpay_payment_id,
    razorpaySubscriptionId: razorpay_subscription_id,
    razorpaySignature: razorpay_signature,
  });

  if (!isSignatureValid) {
    return NextResponse.json(
      { error: "Invalid Razorpay payment signature. Verification rejected.", code: "INVALID_SIGNATURE" },
      { status: 400 }
    );
  }

  // 2. Confirm this subscription record belongs to the authenticated user
  const pendingSub = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: razorpay_subscription_id },
    include: { plan: true },
  });

  if (!pendingSub || pendingSub.userId !== auth.user.id) {
    return NextResponse.json(
      { error: "Forbidden: Subscription does not belong to your account." },
      { status: 403 }
    );
  }

  // 3. Server-side confirmation directly from Razorpay API (never trust frontend callback alone)
  try {
    const [rzPayment, rzSub] = await Promise.all([
      fetchRazorpayPayment(razorpay_payment_id),
      fetchRazorpaySubscription(razorpay_subscription_id),
    ]);

    const acceptablePaymentStatuses = new Set(["captured", "authorized"]);
    const acceptableSubStatuses = new Set(["authenticated", "active"]);

    if (
      !acceptablePaymentStatuses.has(rzPayment.status) &&
      !acceptableSubStatuses.has(rzSub.status)
    ) {
      return NextResponse.json(
        {
          error: `Payment has not completed (payment=${rzPayment.status}, subscription=${rzSub.status}).`,
          code: "PAYMENT_NOT_CONFIRMED",
        },
        { status: 402 }
      );
    }

    const activated = await activateVerifiedPaidSubscription({
      userId: auth.user.id,
      planCode: pendingSub.plan.code,
      billingInterval: pendingSub.billingInterval === "ANNUAL" ? "ANNUAL" : "MONTHLY",
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpayCustomerId: rzSub.customer_id,
      razorpayInvoiceId: rzPayment.invoice_id,
      razorpayPlanId: rzSub.plan_id,
      amountPaise: rzPayment.amount,
      currency: rzPayment.currency || "INR",
      periodStart: rzSub.current_start ? new Date(rzSub.current_start * 1000) : undefined,
      periodEnd: rzSub.current_end ? new Date(rzSub.current_end * 1000) : undefined,
      metadata: { verifiedVia: "checkout_callback_and_api" },
    });

    return NextResponse.json({
      success: true,
      subscription: activated.subscription,
      transaction: activated.transaction,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to confirm payment with Razorpay." },
      { status: 502 }
    );
  }
}
