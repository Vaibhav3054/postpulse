import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, SubscriptionSource, SubscriptionStatus } from "@prisma/client";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { expireElapsedSubscriptions } from "@/lib/billing/subscription-service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  // Sweep any newly expired subscriptions before computing live metrics
  await expireElapsedSubscriptions().catch(() => {});

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalWorkspaces,
    activeSubs,
    expiredSubs,
    capturedPaymentsAgg,
    capturedPaymentsCount,
    failedPaymentsCount,
    refundedPaymentsCount,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.workspace.count(),
    prisma.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.AUTHENTICATED] } },
      include: { plan: true },
    }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.REVOKED] } },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.CAPTURED },
      _sum: { amountPaise: true },
    }),
    prisma.paymentTransaction.count({ where: { status: PaymentStatus.CAPTURED } }),
    prisma.paymentTransaction.count({ where: { status: PaymentStatus.FAILED } }),
    prisma.paymentTransaction.count({ where: { status: PaymentStatus.REFUNDED } }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  let activePaidSubscriptions = 0;
  let activeComplimentarySubscriptions = 0;
  let proSubscriptions = 0;
  let agencySubscriptions = 0;
  let mrrInr = 0;

  for (const sub of activeSubs) {
    const code = sub.plan.code.toLowerCase();
    if (code === "pro" || code === "creator") proSubscriptions++;
    if (code === "agency") agencySubscriptions++;

    if (sub.source === SubscriptionSource.PAID) {
      activePaidSubscriptions++;
      // MRR strictly counts verified PAID subscriptions — NEVER complimentary access!
      if (sub.billingInterval === "ANNUAL") {
        mrrInr += Math.round((sub.plan.priceAnnualInr || 0) / 12);
      } else {
        mrrInr += sub.plan.priceMonthlyInr || 0;
      }
    } else if (sub.source === SubscriptionSource.COMPLIMENTARY) {
      activeComplimentarySubscriptions++;
    }
  }

  // Customers without an active paid or complimentary subscription are on the Free plan
  const usersWithElevatedSub = new Set(
    activeSubs
      .filter((s) => s.source !== SubscriptionSource.FREE)
      .map((s) => s.userId)
  ).size;
  const freeSubscriptions = Math.max(0, totalUsers - usersWithElevatedSub);

  const totalVerifiedRevenueInr = Math.round((capturedPaymentsAgg._sum.amountPaise || 0) / 100);

  return NextResponse.json({
    metrics: {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWorkspaces,
      freeSubscriptions,
      proSubscriptions,
      agencySubscriptions,
      activePaidSubscriptions,
      activeComplimentarySubscriptions,
      expiredSubscriptions: expiredSubs,
      mrrInr,
      totalVerifiedRevenueInr,
      totalVerifiedPayments: capturedPaymentsCount,
      failedPayments: failedPaymentsCount,
      refundedPayments: refundedPaymentsCount,
    },
    recentAuditLogs,
  });
}
