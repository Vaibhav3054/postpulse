import crypto from "crypto";
import {
  BillingInterval,
  PaymentStatus,
  SubscriptionSource,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import { SUBSCRIPTION_PLANS, resolveWorkspacePlan } from "../quota";

const CANONICAL_PLAN_DEFAULTS = [
  {
    code: "free",
    name: "Free Starter",
    priceCents: 0,
    priceMonthlyInr: 0,
    priceAnnualInr: 0,
    maxWorkspaces: 1,
    maxSocialAccounts: 3,
    maxScheduledPostsPerMonth: 30,
    maxStorageMb: 500,
    maxTeamMembers: 1,
    features: SUBSCRIPTION_PLANS.free.features,
  },
  {
    code: "pro",
    name: "Pro Creator",
    priceCents: 79900,
    priceMonthlyInr: 799,
    priceAnnualInr: 7990,
    maxWorkspaces: 3,
    maxSocialAccounts: 10,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 5120,
    maxTeamMembers: 3,
    features: SUBSCRIPTION_PLANS.pro.features,
  },
  {
    code: "agency",
    name: "Agency",
    priceCents: 299900,
    priceMonthlyInr: 2999,
    priceAnnualInr: 29990,
    maxWorkspaces: 50,
    maxSocialAccounts: 50,
    maxScheduledPostsPerMonth: 99999,
    maxStorageMb: 25600,
    maxTeamMembers: 15,
    features: SUBSCRIPTION_PLANS.agency.features,
  },
];

let canonicalPlansEnsured = false;

/**
 * Ensures canonical `free`, `pro`, and `agency` plans exist in PostgreSQL without deleting
 * any legacy plan rows or overwriting admin-customized pricing once populated.
 */
export async function ensureCanonicalPlans() {
  if (canonicalPlansEnsured) {
    return prisma.subscriptionPlan.findMany({
      where: { code: { in: ["free", "pro", "agency"] }, isActive: true },
      orderBy: { priceMonthlyInr: "asc" },
    });
  }

  for (const def of CANONICAL_PLAN_DEFAULTS) {
    const upserted = await prisma.subscriptionPlan.upsert({
      where: { code: def.code },
      update: {},
      create: {
        code: def.code,
        name: def.name,
        priceCents: def.priceCents,
        priceMonthlyInr: def.priceMonthlyInr,
        priceAnnualInr: def.priceAnnualInr,
        maxWorkspaces: def.maxWorkspaces,
        maxSocialAccounts: def.maxSocialAccounts,
        maxScheduledPostsPerMonth: def.maxScheduledPostsPerMonth,
        maxStorageMb: def.maxStorageMb,
        maxTeamMembers: def.maxTeamMembers,
        features: def.features as unknown as object,
        isActive: true,
      },
    });

    if (upserted.priceMonthlyInr === 0 && def.priceMonthlyInr > 0) {
      // Backfill new additive INR fields for pre-existing rows without clobbering custom admin edits
      await prisma.subscriptionPlan.update({
        where: { id: upserted.id },
        data: {
          priceMonthlyInr: def.priceMonthlyInr,
          priceAnnualInr: def.priceAnnualInr,
          features: def.features as unknown as object,
        },
      });
    }
  }

  canonicalPlansEnsured = true;
  return prisma.subscriptionPlan.findMany({
    where: { code: { in: ["free", "pro", "agency"] }, isActive: true },
    orderBy: { priceMonthlyInr: "asc" },
  });
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PP-${ym}-${suffix}`;
}

/**
 * Syncs Workspace.planId for ALL workspaces owned by userId so legacy per-workspace
 * quota checks stay 100% consistent with the Customer/Account-level Subscription.
 */
export async function syncUserWorkspacesPlan(userId: string, planId: string): Promise<void> {
  await prisma.workspace.updateMany({
    where: { ownerId: userId },
    data: { planId },
  });
}

/**
 * Sweeps all expired ACTIVE paid/complimentary subscriptions across the platform,
 * transitions them to EXPIRED, and syncs owners' workspaces back to the Free plan.
 */
export async function expireElapsedSubscriptions(): Promise<number> {
  const now = new Date();
  const elapsed = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] },
      source: { in: [SubscriptionSource.PAID, SubscriptionSource.COMPLIMENTARY] },
      isIndefinite: false,
      currentPeriodEnd: { lte: now },
    },
  });

  if (elapsed.length === 0) return 0;

  await ensureCanonicalPlans();
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });

  for (const sub of elapsed) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.EXPIRED,
        endedAt: now,
      },
    });

    if (freePlan) {
      // Check if the user has another still-active subscription before downgrading to Free
      const anotherActive = await prisma.subscription.findFirst({
        where: {
          userId: sub.userId,
          id: { not: sub.id },
          status: SubscriptionStatus.ACTIVE,
          OR: [{ isIndefinite: true }, { currentPeriodEnd: { gt: now } }, { currentPeriodEnd: null }],
        },
        include: { plan: true },
      });

      await syncUserWorkspacesPlan(sub.userId, anotherActive ? anotherActive.planId : freePlan.id);
    }
  }

  return elapsed.length;
}

/**
 * Returns the customer's effective active Subscription + PlanLimits.
 * Automatically expires elapsed subscriptions on read so expired plans never retain paid quotas.
 */
export async function getEffectiveUserSubscription(userId: string) {
  await ensureCanonicalPlans();
  const now = new Date();

  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.AUTHENTICATED, SubscriptionStatus.PAST_DUE] },
    },
    include: { plan: true },
    orderBy: [{ createdAt: "desc" }],
  });

  if (
    activeSub &&
    activeSub.source !== SubscriptionSource.FREE &&
    !activeSub.isIndefinite &&
    activeSub.currentPeriodEnd &&
    activeSub.currentPeriodEnd <= now
  ) {
    await prisma.subscription.update({
      where: { id: activeSub.id },
      data: { status: SubscriptionStatus.EXPIRED, endedAt: now },
    });

    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });
    if (freePlan) {
      await syncUserWorkspacesPlan(userId, freePlan.id);
      return {
        subscription: null,
        plan: resolveWorkspacePlan(freePlan),
        dbPlan: freePlan,
      };
    }
  }

  if (activeSub) {
    return {
      subscription: activeSub,
      plan: resolveWorkspacePlan(activeSub.plan),
      dbPlan: activeSub.plan,
    };
  }

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });
  return {
    subscription: null,
    plan: resolveWorkspacePlan(freePlan),
    dbPlan: freePlan,
  };
}

/**
 * Activates or renews a verified PAID subscription after cryptographic signature/webhook verification.
 * Records a verified PaymentTransaction (idempotent by razorpayPaymentId) and syncs all owned workspaces.
 */
export async function activateVerifiedPaidSubscription(params: {
  userId: string;
  planCode: string;
  billingInterval: "MONTHLY" | "ANNUAL";
  razorpaySubscriptionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpayCustomerId?: string;
  razorpayInvoiceId?: string;
  razorpayPlanId?: string;
  amountPaise: number;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
  metadata?: Record<string, unknown>;
}) {
  await ensureCanonicalPlans();
  const dbPlan = await prisma.subscriptionPlan.findUnique({
    where: { code: params.planCode.toLowerCase() },
  });
  if (!dbPlan) {
    throw new Error(`Unknown subscription plan code: ${params.planCode}`);
  }

  const now = new Date();
  const periodStart = params.periodStart || now;
  const durationDays = params.billingInterval === "ANNUAL" ? 365 : 30;
  const periodEnd =
    params.periodEnd || new Date(periodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Supersede any other active subscription for this user when upgrading/switching plans
  await prisma.subscription.updateMany({
    where: {
      userId: params.userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.AUTHENTICATED, SubscriptionStatus.CREATED] },
      ...(params.razorpaySubscriptionId
        ? { NOT: { razorpaySubscriptionId: params.razorpaySubscriptionId } }
        : {}),
    },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
      endedAt: now,
    },
  });

  // Upsert subscription by razorpaySubscriptionId if provided
  let subscription;
  if (params.razorpaySubscriptionId) {
    subscription = await prisma.subscription.upsert({
      where: { razorpaySubscriptionId: params.razorpaySubscriptionId },
      update: {
        planId: dbPlan.id,
        source: SubscriptionSource.PAID,
        billingInterval: params.billingInterval as BillingInterval,
        status: SubscriptionStatus.ACTIVE,
        razorpayCustomerId: params.razorpayCustomerId,
        razorpayPlanId: params.razorpayPlanId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        endedAt: null,
        metadata: (params.metadata || {}) as object,
      },
      create: {
        userId: params.userId,
        planId: dbPlan.id,
        source: SubscriptionSource.PAID,
        billingInterval: params.billingInterval as BillingInterval,
        status: SubscriptionStatus.ACTIVE,
        razorpayCustomerId: params.razorpayCustomerId,
        razorpaySubscriptionId: params.razorpaySubscriptionId,
        razorpayPlanId: params.razorpayPlanId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        metadata: (params.metadata || {}) as object,
      },
      include: { plan: true },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        userId: params.userId,
        planId: dbPlan.id,
        source: SubscriptionSource.PAID,
        billingInterval: params.billingInterval as BillingInterval,
        status: SubscriptionStatus.ACTIVE,
        razorpayCustomerId: params.razorpayCustomerId,
        razorpayPlanId: params.razorpayPlanId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        metadata: (params.metadata || {}) as object,
      },
      include: { plan: true },
    });
  }

  // Record verified PaymentTransaction idempotently (by unique razorpayPaymentId)
  let transaction = null;
  if (params.razorpayPaymentId) {
    transaction = await prisma.paymentTransaction.upsert({
      where: { razorpayPaymentId: params.razorpayPaymentId },
      update: {
        subscriptionId: subscription.id,
        status: PaymentStatus.CAPTURED,
        amountPaise: params.amountPaise,
        razorpayInvoiceId: params.razorpayInvoiceId,
        paidAt: now,
      },
      create: {
        userId: params.userId,
        subscriptionId: subscription.id,
        planCode: dbPlan.code,
        billingInterval: params.billingInterval as BillingInterval,
        amountPaise: params.amountPaise,
        currency: params.currency || "INR",
        status: PaymentStatus.CAPTURED,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySubscriptionId: params.razorpaySubscriptionId,
        razorpayInvoiceId: params.razorpayInvoiceId,
        invoiceNumber: generateInvoiceNumber(),
        paidAt: now,
        metadata: (params.metadata || {}) as object,
      },
    });
  }

  // Sync all workspaces owned by this user to the new plan
  await syncUserWorkspacesPlan(params.userId, dbPlan.id);

  return { subscription, transaction };
}

export async function recordFailedPayment(params: {
  userId?: string;
  razorpaySubscriptionId?: string;
  razorpayPaymentId?: string;
  amountPaise: number;
  planCode?: string;
  failureReason: string;
}) {
  let sub = params.razorpaySubscriptionId
    ? await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: params.razorpaySubscriptionId },
        include: { plan: true },
      })
    : null;

  const targetUserId = params.userId || sub?.userId;
  if (!targetUserId) return null;

  if (sub) {
    sub = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.PAST_DUE },
      include: { plan: true },
    });
  }

  if (params.razorpayPaymentId) {
    return prisma.paymentTransaction.upsert({
      where: { razorpayPaymentId: params.razorpayPaymentId },
      update: {
        status: PaymentStatus.FAILED,
        failureReason: params.failureReason,
      },
      create: {
        userId: targetUserId,
        subscriptionId: sub?.id,
        planCode: params.planCode || sub?.plan.code || "pro",
        billingInterval: sub?.billingInterval || BillingInterval.MONTHLY,
        amountPaise: params.amountPaise,
        currency: "INR",
        status: PaymentStatus.FAILED,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySubscriptionId: params.razorpaySubscriptionId,
        failureReason: params.failureReason,
      },
    });
  }

  return prisma.paymentTransaction.create({
    data: {
      userId: targetUserId,
      subscriptionId: sub?.id,
      planCode: params.planCode || sub?.plan.code || "pro",
      billingInterval: sub?.billingInterval || BillingInterval.MONTHLY,
      amountPaise: params.amountPaise,
      currency: "INR",
      status: PaymentStatus.FAILED,
      razorpaySubscriptionId: params.razorpaySubscriptionId,
      failureReason: params.failureReason,
    },
  });
}

export async function recordRefundProcessed(params: {
  razorpayPaymentId: string;
  refundAmountPaise: number;
}) {
  const existing = await prisma.paymentTransaction.findUnique({
    where: { razorpayPaymentId: params.razorpayPaymentId },
  });
  if (!existing) return null;

  return prisma.paymentTransaction.update({
    where: { id: existing.id },
    data: {
      status: PaymentStatus.REFUNDED,
      refundAmountPaise: params.refundAmountPaise,
    },
  });
}
