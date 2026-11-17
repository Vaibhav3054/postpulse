import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getRazorpayConfig } from "@/lib/billing/razorpay";
import {
  ensureCanonicalPlans,
  getEffectiveUserSubscription,
} from "@/lib/billing/subscription-service";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const [plans, effective, transactions] = await Promise.all([
    ensureCanonicalPlans(),
    getEffectiveUserSubscription(auth.user.id),
    prisma.paymentTransaction.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const razorpayConfig = getRazorpayConfig();

  return NextResponse.json({
    subscription: effective.subscription,
    currentPlan: effective.plan,
    plans: plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      priceMonthlyInr: p.priceMonthlyInr,
      priceAnnualInr: p.priceAnnualInr,
      maxWorkspaces: p.maxWorkspaces,
      maxSocialAccounts: p.maxSocialAccounts,
      maxScheduledPostsPerMonth: p.maxScheduledPostsPerMonth,
      maxStorageMb: p.maxStorageMb,
      maxTeamMembers: p.maxTeamMembers,
      features: Array.isArray(p.features) ? p.features : [],
    })),
    transactions,
    gateway: {
      provider: "razorpay",
      isConfigured: razorpayConfig.isConfigured,
      isTestMode: razorpayConfig.isTestMode,
      publicKeyId: razorpayConfig.publicKeyId,
      missingEnvVars: razorpayConfig.missingEnvVars,
    },
  });
}
