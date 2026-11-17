import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BillingInterval, SubscriptionSource, SubscriptionStatus } from "@prisma/client";
import { recordAdminAuditLog, requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";
import {
  ensureCanonicalPlans,
  expireElapsedSubscriptions,
  syncUserWorkspacesPlan,
} from "@/lib/billing/subscription-service";

const manageSubscriptionSchema = z.object({
  action: z.enum([
    "assign",
    "upgrade",
    "downgrade",
    "extend",
    "change_expiry",
    "cancel",
    "revoke",
    "restore",
  ]),
  userId: z.string().trim().min(1),
  subscriptionId: z.string().trim().optional(),
  planCode: z.enum(["free", "pro", "agency"]).optional(),
  billingInterval: z.enum(["MONTHLY", "ANNUAL", "NONE"]).optional(),
  extendDays: z.number().int().min(1).max(3650).optional(),
  customExpiryDate: z.string().datetime({ offset: true }).optional(),
  reason: z.string().trim().min(3, "A reason is required for subscription changes.").max(500),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  await expireElapsedSubscriptions().catch(() => {});

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.toUpperCase();
  const source = searchParams.get("source")?.toUpperCase();

  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (source && source !== "ALL") where.source = source;

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, fullName: true, status: true } },
      plan: { select: { id: true, code: true, name: true, priceMonthlyInr: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return NextResponse.json({ subscriptions });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, manageSubscriptionSchema);
  if (parsed.error) return parsed.error;

  const {
    action,
    userId,
    subscriptionId,
    planCode,
    billingInterval,
    extendDays,
    customExpiryDate,
    reason,
  } = parsed.data;

  await ensureCanonicalPlans();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const now = new Date();
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });

  const existingSub = subscriptionId
    ? await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      })
    : await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      });

  if (action === "assign" || action === "upgrade" || action === "downgrade") {
    const desiredCode = planCode || "pro";
    const dbPlan = await prisma.subscriptionPlan.findUnique({ where: { code: desiredCode } });
    if (!dbPlan) {
      return NextResponse.json({ error: `Plan ${desiredCode} not found.` }, { status: 404 });
    }

    // Close existing active subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.AUTHENTICATED, SubscriptionStatus.PAST_DUE] },
      },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: now, endedAt: now },
    });

    const periodEnd = customExpiryDate
      ? new Date(customExpiryDate)
      : desiredCode === "free"
        ? null
        : new Date(now.getTime() + (extendDays || 30) * 86400 * 1000);

    // Note: Admin manual assignments are marked COMPLIMENTARY (not PAID) so they NEVER inflate real Razorpay revenue!
    const created = await prisma.subscription.create({
      data: {
        userId,
        planId: dbPlan.id,
        source: desiredCode === "free" ? SubscriptionSource.FREE : SubscriptionSource.COMPLIMENTARY,
        billingInterval: (billingInterval || (desiredCode === "free" ? "NONE" : "MONTHLY")) as BillingInterval,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        complimentaryReason: reason,
        grantedByAdminId: auth.admin.id,
        metadata: { adminAction: action },
      },
      include: { plan: true },
    });

    await syncUserWorkspacesPlan(userId, dbPlan.id);

    await recordAdminAuditLog({
      admin: auth.admin,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      action: `SUBSCRIPTION_${action.toUpperCase()}`,
      entityType: "SUBSCRIPTION",
      entityId: created.id,
      previousValue: existingSub
        ? { planCode: existingSub.plan.code, status: existingSub.status }
        : null,
      newValue: {
        planCode: dbPlan.code,
        status: created.status,
        source: created.source,
        currentPeriodEnd: created.currentPeriodEnd,
      },
      reason,
      req,
    });

    return NextResponse.json({ success: true, subscription: created });
  }

  if (!existingSub) {
    return NextResponse.json(
      { error: "No subscription record found for this customer." },
      { status: 404 }
    );
  }

  if (action === "extend" || action === "change_expiry") {
    const baseDate =
      existingSub.currentPeriodEnd && existingSub.currentPeriodEnd > now
        ? existingSub.currentPeriodEnd
        : now;
    const newExpiry =
      action === "change_expiry" && customExpiryDate
        ? new Date(customExpiryDate)
        : new Date(baseDate.getTime() + (extendDays || 30) * 86400 * 1000);

    const updated = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        currentPeriodEnd: newExpiry,
        isIndefinite: false,
        status: SubscriptionStatus.ACTIVE,
        endedAt: null,
      },
      include: { plan: true },
    });

    await syncUserWorkspacesPlan(userId, updated.planId);

    await recordAdminAuditLog({
      admin: auth.admin,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      action: action === "extend" ? "SUBSCRIPTION_EXTENDED" : "SUBSCRIPTION_EXPIRY_CHANGED",
      entityType: "SUBSCRIPTION",
      entityId: updated.id,
      previousValue: { currentPeriodEnd: existingSub.currentPeriodEnd, status: existingSub.status },
      newValue: { currentPeriodEnd: updated.currentPeriodEnd, status: updated.status },
      reason,
      req,
    });

    return NextResponse.json({ success: true, subscription: updated });
  }

  if (action === "cancel" || action === "revoke") {
    const newStatus =
      action === "revoke" ? SubscriptionStatus.REVOKED : SubscriptionStatus.CANCELLED;

    const updated = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: newStatus,
        cancelledAt: now,
        endedAt: now,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    if (freePlan) {
      await syncUserWorkspacesPlan(userId, freePlan.id);
    }

    await recordAdminAuditLog({
      admin: auth.admin,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      action: action === "revoke" ? "SUBSCRIPTION_REVOKED" : "SUBSCRIPTION_CANCELLED",
      entityType: "SUBSCRIPTION",
      entityId: updated.id,
      previousValue: { planCode: existingSub.plan.code, status: existingSub.status },
      newValue: { planCode: "free", status: newStatus },
      reason,
      req,
    });

    return NextResponse.json({ success: true, subscription: updated });
  }

  if (action === "restore") {
    const restoredEnd =
      existingSub.currentPeriodEnd && existingSub.currentPeriodEnd > now
        ? existingSub.currentPeriodEnd
        : new Date(now.getTime() + 30 * 86400 * 1000);

    const updated = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        endedAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: existingSub.isIndefinite ? null : restoredEnd,
      },
      include: { plan: true },
    });

    await syncUserWorkspacesPlan(userId, updated.planId);

    await recordAdminAuditLog({
      admin: auth.admin,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      action: "SUBSCRIPTION_RESTORED",
      entityType: "SUBSCRIPTION",
      entityId: updated.id,
      previousValue: { status: existingSub.status },
      newValue: { status: updated.status, currentPeriodEnd: updated.currentPeriodEnd },
      reason,
      req,
    });

    return NextResponse.json({ success: true, subscription: updated });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
