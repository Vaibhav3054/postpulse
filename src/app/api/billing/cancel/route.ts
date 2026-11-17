import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SubscriptionSource, SubscriptionStatus } from "@prisma/client";
import { requireApiSession } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { cancelRazorpaySubscription, getRazorpayConfig } from "@/lib/billing/razorpay";
import { ensureCanonicalPlans, syncUserWorkspacesPlan } from "@/lib/billing/subscription-service";

const cancelSchema = z.object({
  cancelImmediately: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, cancelSchema);
  if (parsed.error) return parsed.error;

  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId: auth.user.id,
      source: SubscriptionSource.PAID,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!activeSub) {
    return NextResponse.json(
      { error: "No active paid subscription found to cancel." },
      { status: 404 }
    );
  }

  const rzConfig = getRazorpayConfig();
  if (activeSub.razorpaySubscriptionId && rzConfig.isConfigured) {
    try {
      await cancelRazorpaySubscription(
        activeSub.razorpaySubscriptionId,
        !parsed.data.cancelImmediately
      );
    } catch (err: unknown) {
      return NextResponse.json(
        { error: (err as Error).message || "Failed to cancel subscription with Razorpay." },
        { status: 502 }
      );
    }
  }

  const now = new Date();
  if (parsed.data.cancelImmediately) {
    const updated = await prisma.subscription.update({
      where: { id: activeSub.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelAtPeriodEnd: false,
        cancelledAt: now,
        endedAt: now,
      },
    });
    await ensureCanonicalPlans();
    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });
    if (freePlan) {
      await syncUserWorkspacesPlan(auth.user.id, freePlan.id);
    }
    return NextResponse.json({ success: true, subscription: updated });
  }

  const updated = await prisma.subscription.update({
    where: { id: activeSub.id },
    data: {
      cancelAtPeriodEnd: true,
      cancelledAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    subscription: updated,
    message: "Your subscription will remain active until the end of the current billing period.",
  });
}
