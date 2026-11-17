import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceRole } from "@prisma/client";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { getEffectiveUserSubscription } from "@/lib/billing/subscription-service";

const updateRoleSchema = z.object({
  memberId: z.string().trim().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id: workspaceId } = await params;
  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const effective = await getEffectiveUserSubscription(workspace.ownerId);
  const canViewInvites =
    memberCheck.membership.role === "OWNER" || memberCheck.membership.role === "ADMIN";

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true } },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    canViewInvites
      ? prisma.workspaceInvitation.findMany({
          where: { workspaceId, status: "PENDING" },
          include: {
            invitedByUser: { select: { email: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      email: m.user.email,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      status: m.user.status,
    })),
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedByUser.fullName || inv.invitedByUser.email,
    })),
    quota: {
      usedSeats: members.length,
      pendingInvitations: invitations.length,
      maxTeamMembers: effective.plan.maxTeamMembers,
      planName: effective.plan.name,
    },
    currentUserRole: memberCheck.membership.role,
  });
}

/**
 * PATCH /api/workspaces/[id]/members — Change member role (OWNER only; strict anti-self-escalation).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id: workspaceId } = await params;

  // Strictly OWNER only — prevents ordinary MEMBERs or ADMINs from promoting themselves
  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER"]);
  if (memberCheck.error) return memberCheck.error;

  const parsed = await parseJsonBody(req, updateRoleSchema);
  if (parsed.error) return parsed.error;

  const { memberId, role } = parsed.data;

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Team member not found in this workspace." }, { status: 404 });
  }

  if (target.role === WorkspaceRole.OWNER) {
    return NextResponse.json(
      { error: "Forbidden: Cannot alter the Workspace Owner's role." },
      { status: 403 }
    );
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role: role as WorkspaceRole },
  });

  await db.activity.log({
    workspaceId,
    userId: auth.user.id,
    action: "TEAM_MEMBER_ROLE_UPDATED",
    entityType: "WORKSPACE_MEMBER",
    entityId: memberId,
    metadata: {
      memberEmail: target.user.email,
      previousRole: target.role,
      newRole: role,
    },
  });

  return NextResponse.json({ success: true, member: updated });
}

/**
 * DELETE /api/workspaces/[id]/members?memberId=... — Remove a workspace team member.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id: workspaceId } = await params;
  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId")?.trim();
  if (!memberId) {
    return NextResponse.json({ error: "memberId query parameter is required." }, { status: 400 });
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });

  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Team member not found in this workspace." }, { status: 404 });
  }

  if (target.role === WorkspaceRole.OWNER) {
    return NextResponse.json(
      { error: "Forbidden: The Workspace Owner cannot be removed." },
      { status: 403 }
    );
  }

  // ADMIN can only remove MEMBERs (not other ADMINs)
  if (
    memberCheck.membership.role === WorkspaceRole.ADMIN &&
    target.role === WorkspaceRole.ADMIN
  ) {
    return NextResponse.json(
      { error: "Forbidden: Only the Workspace Owner can remove an Admin." },
      { status: 403 }
    );
  }

  await prisma.workspaceMember.delete({ where: { id: memberId } });

  await db.activity.log({
    workspaceId,
    userId: auth.user.id,
    action: "TEAM_MEMBER_REMOVED",
    entityType: "WORKSPACE_MEMBER",
    entityId: memberId,
    metadata: { removedEmail: target.user.email, previousRole: target.role },
  });

  return NextResponse.json({ success: true });
}
