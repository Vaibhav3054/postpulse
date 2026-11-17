import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const account = await db.socialAccounts.findById(id);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const memberCheck = await requireWorkspaceMember(account.workspaceId, auth.user.id, [
    "OWNER",
    "ADMIN",
  ]);
  if (memberCheck.error) return memberCheck.error;

  try {
    await db.socialAccounts.disconnect(id);
    await db.activity.log({
      workspaceId: account.workspaceId,
      userId: auth.user.id,
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
