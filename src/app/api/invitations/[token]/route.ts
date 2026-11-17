import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InvitationStatus } from "@prisma/client";
import { requireApiSession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { getEffectiveUserSubscription } from "@/lib/billing/subscription-service";

const respondSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * GET /api/invitations/[token] — Inspect invitation metadata safely (no workspace secrets exposed).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid invitation token." }, { status: 400 });
  }

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      workspace: { select: { name: true, slug: true } },
      invitedByUser: { select: { fullName: true, email: true } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found or link is invalid." }, { status: 404 });
  }

  const isExpired = invitation.expiresAt <= new Date();
  if (invitation.status === InvitationStatus.PENDING && isExpired) {
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
  }

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      workspaceName: invitation.workspace.name,
      email: invitation.email,
      role: invitation.role,
      status:
        invitation.status === InvitationStatus.PENDING && isExpired
          ? InvitationStatus.EXPIRED
          : invitation.status,
      expiresAt: invitation.expiresAt,
      invitedBy: invitation.invitedByUser.fullName || invitation.invitedByUser.email,
    },
  });
}

/**
 * POST /api/invitations/[token] — Accept or reject a workspace invitation.
 * Strictly verifies email ownership and grants access ONLY to invitation.workspaceId.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, respondSchema);
  if (parsed.error) return parsed.error;

  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid invitation token." }, { status: 400 });
  }

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      workspace: { select: { id: true, name: true, slug: true, ownerId: true } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  // Strict email match check: prevent someone else from redeeming another person's invite link
  if (auth.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invitation was sent to ${invitation.email}. Please sign in with that exact email address to respond.`,
      },
      { status: 403 }
    );
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    return NextResponse.json(
      { error: `This invitation is no longer active (status: ${invitation.status}).` },
      { status: 409 }
    );
  }

  const now = new Date();
  if (invitation.expiresAt <= now) {
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    return NextResponse.json(
      { error: "This invitation has expired. Ask the workspace admin to resend it." },
      { status: 410 }
    );
  }

  if (parsed.data.action === "reject") {
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REJECTED, rejectedAt: now },
    });

    await db.activity.log({
      workspaceId: invitation.workspaceId,
      userId: auth.user.id,
      action: "TEAM_INVITATION_REJECTED",
      entityType: "WORKSPACE_INVITATION",
      entityId: invitation.id,
      metadata: { email: invitation.email },
    });

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  // ACCEPT FLOW: Verify team seat quota & atomically grant membership ONLY for invitation.workspaceId
  const effective = await getEffectiveUserSubscription(invitation.workspace.ownerId);
  const currentMembers = await prisma.workspaceMember.count({
    where: { workspaceId: invitation.workspaceId },
  });
  if (currentMembers >= effective.plan.maxTeamMembers) {
    return NextResponse.json(
      {
        error:
          "This workspace has reached its plan team seat limit. Ask the workspace owner to upgrade.",
        code: "QUOTA_EXCEEDED",
      },
      { status: 403 }
    );
  }

  // Atomic one-time redemption
  const claimed = await prisma.workspaceInvitation.updateMany({
    where: { id: invitation.id, status: InvitationStatus.PENDING },
    data: { status: InvitationStatus.ACCEPTED, acceptedAt: now },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ error: "Invitation was already processed." }, { status: 409 });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId: auth.user.id,
      },
    },
    update: { role: invitation.role },
    create: {
      workspaceId: invitation.workspaceId,
      userId: auth.user.id,
      role: invitation.role,
    },
  });

  await db.activity.log({
    workspaceId: invitation.workspaceId,
    userId: auth.user.id,
    action: "TEAM_INVITATION_ACCEPTED",
    entityType: "WORKSPACE_INVITATION",
    entityId: invitation.id,
    metadata: { email: auth.user.email, role: invitation.role },
  });

  return NextResponse.json({
    success: true,
    status: "ACCEPTED",
    workspaceSlug: invitation.workspace.slug,
    workspaceName: invitation.workspace.name,
  });
}
