import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InvitationStatus, WorkspaceRole } from "@prisma/client";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/notifications";
import { getEffectiveUserSubscription } from "@/lib/billing/subscription-service";

const createInviteSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

const resendInviteSchema = z.object({
  invitationId: z.string().trim().min(1),
});

function hashInviteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function buildInviteUrl(rawToken: string, reqOrigin: string): string {
  const baseUrl = (process.env.APP_URL || process.env.URL || reqOrigin)
    .trim()
    .replace(/\/$/, "");
  return `${baseUrl}/invite/${rawToken}`;
}

/**
 * POST /api/workspaces/[id]/invitations — Invite a new team member by email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id: workspaceId } = await params;
  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const rl = await checkRateLimit(`team:invite:${workspaceId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl, "Too many team invitations sent. Please wait.");
  }

  const parsed = await parseJsonBody(req, createInviteSchema);
  if (parsed.error) return parsed.error;

  const inviteEmail = parsed.data.email.toLowerCase();
  const desiredRole = parsed.data.role as WorkspaceRole;

  // Prevent ADMIN from inviting another ADMIN (only OWNER can grant ADMIN role)
  if (
    memberCheck.membership.role === WorkspaceRole.ADMIN &&
    desiredRole === WorkspaceRole.ADMIN
  ) {
    return NextResponse.json(
      { error: "Forbidden: Only the Workspace Owner can invite an Admin." },
      { status: 403 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true, ownerId: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  // Enforce plan maxTeamMembers seat quota (active members + active pending invites)
  const effective = await getEffectiveUserSubscription(workspace.ownerId);
  const now = new Date();
  const [memberCount, pendingCount] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.workspaceInvitation.count({
      where: { workspaceId, status: InvitationStatus.PENDING, expiresAt: { gt: now } },
    }),
  ]);

  if (memberCount + pendingCount >= effective.plan.maxTeamMembers) {
    return NextResponse.json(
      {
        error: `Team seat limit reached (${memberCount + pendingCount}/${effective.plan.maxTeamMembers} on ${effective.plan.name}). Upgrade your plan to invite more team members.`,
        code: "QUOTA_EXCEEDED",
        limit: effective.plan.maxTeamMembers,
        current: memberCount + pendingCount,
      },
      { status: 403 }
    );
  }

  // Check if already a member
  const existingUser = await prisma.user.findUnique({
    where: { email: inviteEmail },
    select: { id: true },
  });
  if (existingUser) {
    const alreadyMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (alreadyMember) {
      return NextResponse.json(
        { error: "This user is already a member of this workspace." },
        { status: 409 }
      );
    }
  }

  // Check if a pending invite already exists for this email in this workspace
  const existingPending = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email: inviteEmail,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: now },
    },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email. Use Resend instead." },
      { status: 409 }
    );
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      email: inviteEmail,
      role: desiredRole,
      tokenHash,
      status: InvitationStatus.PENDING,
      invitedByUserId: auth.user.id,
      expiresAt,
    },
  });

  const { origin } = new URL(req.url);
  const inviteUrl = buildInviteUrl(rawToken, origin);

  const emailResult = await sendTransactionalEmail({
    to: inviteEmail,
    subject: `You're invited to join "${workspace.name}" on PostPulse`,
    text: `${auth.user.fullName || auth.user.email} invited you to join "${workspace.name}" as ${desiredRole}.\n\nAccept your invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">You&apos;re invited to join ${workspace.name}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
          ${auth.user.fullName || auth.user.email} invited you to collaborate on <strong>${workspace.name}</strong> with the <strong>${desiredRole}</strong> role.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Accept Invitation</a>
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">This link expires in 7 days and is scoped strictly to ${workspace.name}.</p>
      </div>
    `,
  });

  await db.activity.log({
    workspaceId,
    userId: auth.user.id,
    action: "TEAM_INVITATION_SENT",
    entityType: "WORKSPACE_INVITATION",
    entityId: invitation.id,
    metadata: { email: inviteEmail, role: desiredRole, emailMode: emailResult.mode },
  });

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl,
      emailDelivery: emailResult,
    },
    { status: 201 }
  );
}

/**
 * PATCH /api/workspaces/[id]/invitations — Resend a pending invitation (rotates token & extends expiry).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id: workspaceId } = await params;
  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const parsed = await parseJsonBody(req, resendInviteSchema);
  if (parsed.error) return parsed.error;

  const existing = await prisma.workspaceInvitation.findUnique({
    where: { id: parsed.data.invitationId },
    include: { workspace: { select: { name: true } } },
  });

  if (!existing || existing.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Invitation not found in this workspace." }, { status: 404 });
  }
  if (existing.status !== InvitationStatus.PENDING) {
    return NextResponse.json(
      { error: `Cannot resend an invitation with status ${existing.status}.` },
      { status: 400 }
    );
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const updated = await prisma.workspaceInvitation.update({
    where: { id: existing.id },
    data: {
      tokenHash: hashInviteToken(rawToken),
      expiresAt,
    },
  });

  const { origin } = new URL(req.url);
  const inviteUrl = buildInviteUrl(rawToken, origin);

  const emailResult = await sendTransactionalEmail({
    to: existing.email,
    subject: `Reminder: You're invited to join "${existing.workspace.name}" on PostPulse`,
    text: `Accept your invitation to ${existing.workspace.name}: ${inviteUrl}`,
    html: `<p>You're invited to join <strong>${existing.workspace.name}</strong>. <a href="${inviteUrl}">Accept Invitation</a></p>`,
  });

  return NextResponse.json({
    success: true,
    invitation: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
    },
    inviteUrl,
    emailDelivery: emailResult,
  });
}

/**
 * DELETE /api/workspaces/[id]/invitations?invitationId=... — Revoke a pending invitation.
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
  const invitationId = searchParams.get("invitationId")?.trim();
  if (!invitationId) {
    return NextResponse.json({ error: "invitationId is required." }, { status: 400 });
  }

  const existing = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!existing || existing.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Invitation not found in this workspace." }, { status: 404 });
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
  });

  await db.activity.log({
    workspaceId,
    userId: auth.user.id,
    action: "TEAM_INVITATION_REVOKED",
    entityType: "WORKSPACE_INVITATION",
    entityId: invitationId,
    metadata: { email: existing.email },
  });

  return NextResponse.json({ success: true });
}
