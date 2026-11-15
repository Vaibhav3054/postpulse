import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const account = await db.socialAccounts.findById(id);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const membership = await db.workspaces.checkMembership(account.workspaceId, session.id);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: Admin or Owner role required to disconnect accounts." }, { status: 403 });
  }

  try {
    await db.socialAccounts.disconnect(id);
    await db.activity.log({
      workspaceId: account.workspaceId,
      userId: session.id,
      action: "SOCIAL_ACCOUNT_DISCONNECTED",
      entityType: "SOCIAL_ACCOUNT",
      entityId: id,
      metadata: { platform: account.platform, username: account.platformUsername },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to disconnect account" }, { status: 500 });
  }
}
