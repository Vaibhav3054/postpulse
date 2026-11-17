import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAuditLog, requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";
import { ensureCanonicalPlans } from "@/lib/billing/subscription-service";

const updatePlanSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  priceMonthlyInr: z.number().int().min(0).max(1000000).optional(),
  priceAnnualInr: z.number().int().min(0).max(10000000).optional(),
  maxWorkspaces: z.number().int().min(1).max(1000).optional(),
  maxSocialAccounts: z.number().int().min(1).max(1000).optional(),
  maxScheduledPostsPerMonth: z.number().int().min(1).max(1000000).optional(),
  maxStorageMb: z.number().int().min(50).max(1000000).optional(),
  maxTeamMembers: z.number().int().min(1).max(500).optional(),
  razorpayPlanIdMonthly: z.string().trim().max(120).nullable().optional(),
  razorpayPlanIdAnnual: z.string().trim().max(120).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(25).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().trim().min(3).max(400).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  await ensureCanonicalPlans();
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ priceMonthlyInr: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          workspaces: true,
          subscriptions: true,
        },
      },
    },
  });

  return NextResponse.json({ plans });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, updatePlanSchema);
  if (parsed.error) return parsed.error;

  const { id, reason, features, ...updates } = parsed.data;
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }

  // Updating plan definitions preserves all historical Subscription & PaymentTransaction rows untouched
  const updated = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...updates,
      ...(updates.priceMonthlyInr !== undefined
        ? { priceCents: updates.priceMonthlyInr * 100 }
        : {}),
      ...(features !== undefined ? { features: features as unknown as object } : {}),
    },
  });

  await recordAdminAuditLog({
    admin: auth.admin,
    action: "PLAN_UPDATED",
    entityType: "SUBSCRIPTION_PLAN",
    entityId: updated.id,
    previousValue: {
      code: existing.code,
      name: existing.name,
      priceMonthlyInr: existing.priceMonthlyInr,
      priceAnnualInr: existing.priceAnnualInr,
      maxWorkspaces: existing.maxWorkspaces,
      maxSocialAccounts: existing.maxSocialAccounts,
      maxStorageMb: existing.maxStorageMb,
      maxTeamMembers: existing.maxTeamMembers,
      isActive: existing.isActive,
    },
    newValue: {
      code: updated.code,
      name: updated.name,
      priceMonthlyInr: updated.priceMonthlyInr,
      priceAnnualInr: updated.priceAnnualInr,
      maxWorkspaces: updated.maxWorkspaces,
      maxSocialAccounts: updated.maxSocialAccounts,
      maxStorageMb: updated.maxStorageMb,
      maxTeamMembers: updated.maxTeamMembers,
      isActive: updated.isActive,
    },
    reason: reason || "Plan definition updated via Super Admin",
    req,
  });

  return NextResponse.json({ success: true, plan: updated });
}
