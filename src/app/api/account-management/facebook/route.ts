import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, socialAccountId, about, phone, website, hours } = await req.json();

    if (!workspaceId || !socialAccountId) {
      return NextResponse.json({ error: "workspaceId and socialAccountId are required" }, { status: 400 });
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can update Facebook Page settings" },
        { status: 403 }
      );
    }

    const socialAccount = await db.socialAccounts.findById(socialAccountId);
    if (!socialAccount || socialAccount.platform !== "FACEBOOK") {
      return NextResponse.json({ error: "Facebook social account not found" }, { status: 404 });
    }

    const currentMeta = (socialAccount.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...currentMeta,
      ...(about !== undefined ? { about } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(website !== undefined ? { website } : {}),
      ...(hours !== undefined ? { hours } : {}),
      updatedAt: new Date().toISOString(),
    };

    const updated = await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        metadata: updatedMeta as any,
      },
    });

    await db.activity.log({
      workspaceId,
      userId: session.id,
      action: "FB_PAGE_UPDATED",
      entityType: "FACEBOOK_PAGE",
      entityId: socialAccountId,
      metadata: { about, phone, website, hours },
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update Facebook Page" }, { status: 500 });
  }
}
