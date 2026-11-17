import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAuditLog, requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";

const updateUserStatusSchema = z.object({
  userId: z.string().trim().min(1),
  action: z.enum(["suspend", "reactivate"]),
  reason: z.string().trim().min(3, "Please provide a reason for this action.").max(500),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const statusFilter = searchParams.get("status")?.toUpperCase();

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (statusFilter === "ACTIVE" || statusFilter === "SUSPENDED") {
    where.status = statusFilter;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      fullName: true,
      systemRole: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          ownedWorkspaces: true,
          workspaces: true,
        },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          plan: { select: { code: true, name: true } },
        },
      },
      ownedWorkspaces: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    users: users.map((u) => {
      const latestSub = u.subscriptions[0] || null;
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        systemRole: u.systemRole,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        ownedWorkspaceCount: u._count.ownedWorkspaces,
        membershipCount: u._count.workspaces,
        workspaces: u.ownedWorkspaces.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          planCode: w.plan.code,
          planName: w.plan.name,
        })),
        subscription: latestSub
          ? {
              id: latestSub.id,
              planCode: latestSub.plan.code,
              planName: latestSub.plan.name,
              source: latestSub.source,
              status: latestSub.status,
              billingInterval: latestSub.billingInterval,
              currentPeriodEnd: latestSub.currentPeriodEnd,
              isIndefinite: latestSub.isIndefinite,
            }
          : null,
      };
    }),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, updateUserStatusSchema);
  if (parsed.error) return parsed.error;

  const { userId, action, reason } = parsed.data;

  if (userId === auth.admin.id && action === "suspend") {
    return NextResponse.json(
      { error: "Cannot suspend your own active Super Admin account." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true, tokenVersion: true, systemRole: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const newStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE";
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      status: newStatus,
      // Increment tokenVersion on suspend to immediately revoke all active JWT sessions without deleting user data
      ...(action === "suspend" ? { tokenVersion: { increment: 1 } } : {}),
    },
    select: { id: true, email: true, fullName: true, status: true },
  });

  await recordAdminAuditLog({
    admin: auth.admin,
    targetUserId: target.id,
    targetEmail: target.email,
    action: action === "suspend" ? "USER_SUSPENDED" : "USER_REACTIVATED",
    entityType: "USER",
    entityId: target.id,
    previousValue: { status: target.status },
    newValue: { status: newStatus },
    reason,
    req,
  });

  return NextResponse.json({ success: true, user: updated });
}
