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

const grantComplimentarySchema = z.object({
  userId: z.string().trim().min(1),
  planCode: z.enum(["pro", "agency"]),
  durationType: z.enum(["7d", "15d", "30d", "90d", "custom", "indefinite"]),
  customExpiryDate: z.string().optional(),
  authorizeIndefinite: z.boolean().optional().default(false),
  reason: z.string().trim().min(3, "Please provide a clear reason for granting complimentary access.").max(500),
});

const revokeComplimentarySchema = z.object({
  subscriptionId: z.string().trim().min(1),
  reason: z.string().trim().min(3, "Please provide a reason for revoking complimentary access.").max(500),
});

const DURATION_DAYS: Record<string, number> = {
  "7d": 7,
  "15d": 15,
  "30d": 30,
  "90d": 90,
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  await expireElapsedSubscriptions().catch(() => {});

  const grants = await prisma.subscription.findMany({
    where: { source: SubscriptionSource.COMPLIMENTARY },
    include: {
      user: { select: { id: true, email: true, fullName: true, status: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ grants });
}

/**
 * POST /api/platform-admin/complimentary
 * Grants complimentary Pro/Agency access (7d/15d/30d/90d/custom/explicit indefinite).
 * Strictly creates NO PaymentTransaction and generates ZERO fake revenue!
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, grantComplimentarySchema);
  if (parsed.error) return parsed.error;

  const { userId, planCode, durationType, customExpiryDate, authorizeIndefinite, reason } =
    parsed.data;

  if (durationType === "indefinite" && !authorizeIndefinite) {
    return NextResponse.json(
      {
        error:
          "Indefinite complimentary access requires explicit authorization confirmation (authorizeIndefinite: true).",
      },
      { status: 400 }
    );
  }

  const now = new Date();
  let periodEnd: Date | null = null;
  let isIndefinite = false;

  if (durationType === "indefinite") {
    isIndefinite = true;
    periodEnd = null;
  } else if (durationType === "custom") {
    if (!customExpiryDate) {
      return NextResponse.json(
        { error: "customExpiryDate is required when durationType is 'custom'." },
        { status: 400 }
      );
    }
    const parsedDate = new Date(customExpiryDate);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate <= now) {
      return NextResponse.json(
        { error: "Custom expiry date must be a valid future date." },
        { status: 400 }
      );
    }
    periodEnd = parsedDate;
  } else {
    const days = DURATION_DAYS[durationType];
    periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  await ensureCanonicalPlans();
  const [targetUser, dbPlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    }),
    prisma.subscriptionPlan.findUnique({ where: { code: planCode } }),
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  if (!dbPlan) {
    return NextResponse.json({ error: `Plan ${planCode} not found.` }, { status: 404 });
  }

  // Supersede previous active complimentary/free subscriptions (preserve history)
  const previousActive = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.ACTIVE,
    },
    include: { plan: true },
  });

  if (previousActive) {
    await prisma.subscription.update({
      where: { id: previousActive.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: now, endedAt: now },
    });
  }

  const grant = await prisma.subscription.create({
    data: {
      userId,
      planId: dbPlan.id,
      source: SubscriptionSource.COMPLIMENTARY,
      billingInterval: BillingInterval.NONE,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      isIndefinite,
      complimentaryReason: reason,
      grantedByAdminId: auth.admin.id,
      metadata: {
        durationType,
        grantedAt: now.toISOString(),
        grantedByEmail: auth.admin.email,
      },
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  // Sync all owned workspaces to the complimentary plan
  await syncUserWorkspacesPlan(userId, dbPlan.id);

  await recordAdminAuditLog({
    admin: auth.admin,
    targetUserId: targetUser.id,
    targetEmail: targetUser.email,
    action: "COMPLIMENTARY_GRANTED",
    entityType: "SUBSCRIPTION",
    entityId: grant.id,
    previousValue: previousActive
      ? { planCode: previousActive.plan.code, source: previousActive.source }
      : { planCode: "free", source: "FREE" },
    newValue: {
      planCode: dbPlan.code,
      source: "COMPLIMENTARY",
      durationType,
      isIndefinite,
      currentPeriodEnd: periodEnd,
    },
    reason,
    req,
  });

  return NextResponse.json({ success: true, grant }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, revokeComplimentarySchema);
  if (parsed.error) return parsed.error;

  const { subscriptionId, reason } = parsed.data;
  const grant = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, email: true } },
      plan: { select: { code: true } },
    },
  });

  if (!grant || grant.source !== SubscriptionSource.COMPLIMENTARY) {
    return NextResponse.json({ error: "Complimentary grant not found." }, { status: 404 });
  }

  const now = new Date();
  await prisma.subscription.update({
    where: { id: grant.id },
    data: {
      status: SubscriptionStatus.REVOKED,
      endedAt: now,
      cancelledAt: now,
    },
  });

  await ensureCanonicalPlans();
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "free" } });
  if (freePlan) {
    await syncUserWorkspacesPlan(grant.userId, freePlan.id);
  }

  await recordAdminAuditLog({
    admin: auth.admin,
    targetUserId: grant.user.id,
    targetEmail: grant.user.email,
    action: "COMPLIMENTARY_REVOKED",
    entityType: "SUBSCRIPTION",
    entityId: grant.id,
    previousValue: { planCode: grant.plan.code, status: grant.status },
    newValue: { planCode: "free", status: "REVOKED" },
    reason,
    req,
  });

  return NextResponse.json({ success: true });
}
