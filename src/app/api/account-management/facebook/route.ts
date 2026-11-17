import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  requireWorkspaceSocialAccount,
  sanitizeSocialAccount,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { facebookPatchSchema, parseJsonBody } from "@/lib/validation";

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, facebookPatchSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, socialAccountId, about, phone, website, hours } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const ownership = await requireWorkspaceSocialAccount(
    workspaceId,
    socialAccountId,
    "FACEBOOK"
  );
  if (ownership.error) return ownership.error;

  try {
    const currentMeta = (ownership.account.metadata as Record<string, unknown>) || {};
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
        metadata: updatedMeta as object,
      },
    });

    await db.activity.log({
      workspaceId,
      userId: auth.user.id,
      action: "FB_PAGE_UPDATED",
      entityType: "FACEBOOK_PAGE",
      entityId: socialAccountId,
      metadata: { about, phone, website, hours },
    });

    return NextResponse.json({ success: true, account: sanitizeSocialAccount(updated) });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update Facebook Page" }, { status: 500 });
  }
}
