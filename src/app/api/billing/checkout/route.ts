import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BillingInterval, SubscriptionSource, SubscriptionStatus } from "@prisma/client";
import { requireApiSession } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  createRazorpaySubscription,
  getRazorpayConfig,
  getRazorpayPlanIdFromEnv,
} from "@/lib/billing/razorpay";
import { ensureCanonicalPlans } from "@/lib/billing/subscription-service";

const checkoutSchema = z.object({
  planCode: z.enum(["pro", "agency"]),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

/**
 * POST /api/billing/checkout
 * Initiates a Razorpay Subscription checkout session.
 * Never activates a paid plan before cryptographic payment/webhook verification.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, checkoutSchema);
  if (parsed.error) return parsed.error;

  const { planCode, billingInterval } = parsed.data;
  const rzConfig = getRazorpayConfig();

  if (!rzConfig.isConfigured || !rzConfig.publicKeyId) {
    return NextResponse.json(
      {
        error:
          "Razorpay payment credentials are not configured yet. Billing checkout will activate once RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and Razorpay Plan IDs are added to environment variables.",
        code: "RAZORPAY_NOT_CONFIGURED",
        missingEnvVars: rzConfig.missingEnvVars,
      },
      { status: 503 }
    );
  }

  await ensureCanonicalPlans();
  const dbPlan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
  if (!dbPlan || !dbPlan.isActive) {
    return NextResponse.json({ error: "Selected subscription plan is unavailable." }, { status: 404 });
  }

  const razorpayPlanId =
    (billingInterval === "ANNUAL"
      ? dbPlan.razorpayPlanIdAnnual
      : dbPlan.razorpayPlanIdMonthly) || getRazorpayPlanIdFromEnv(planCode, billingInterval);

  if (!razorpayPlanId) {
    return NextResponse.json(
      {
        error: `Razorpay Plan ID is not configured for ${planCode.toUpperCase()} (${billingInterval}). Set RAZORPAY_PLAN_${planCode.toUpperCase()}_${billingInterval} or configure it in Super Admin -> Plans & Pricing.`,
        code: "RAZORPAY_PLAN_ID_MISSING",
      },
      { status: 503 }
    );
  }

  try {
    const totalCount = billingInterval === "ANNUAL" ? 10 : 120; // up to 10 years
    const rzSub = await createRazorpaySubscription({
      razorpayPlanId,
      totalCount,
      notes: {
        userId: auth.user.id,
        userEmail: auth.user.email,
        planCode,
        billingInterval,
      },
    });

    const pendingSub = await prisma.subscription.create({
      data: {
        userId: auth.user.id,
        planId: dbPlan.id,
        source: SubscriptionSource.PAID,
        billingInterval: billingInterval as BillingInterval,
        status: SubscriptionStatus.CREATED,
        razorpaySubscriptionId: rzSub.id,
        razorpayPlanId,
        metadata: {
          initiatedAt: new Date().toISOString(),
          isTestMode: rzConfig.isTestMode,
        },
      },
    });

    const amountInr =
      billingInterval === "ANNUAL" ? dbPlan.priceAnnualInr : dbPlan.priceMonthlyInr;

    return NextResponse.json({
      subscriptionId: pendingSub.id,
      razorpaySubscriptionId: rzSub.id,
      razorpayKeyId: rzConfig.publicKeyId,
      isTestMode: rzConfig.isTestMode,
      planCode,
      planName: dbPlan.name,
      billingInterval,
      amountPaise: amountInr * 100,
      currency: "INR",
      shortUrl: rzSub.short_url,
      prefill: {
        name: auth.user.fullName || "",
        email: auth.user.email,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to initiate Razorpay subscription checkout." },
      { status: 502 }
    );
  }
}
