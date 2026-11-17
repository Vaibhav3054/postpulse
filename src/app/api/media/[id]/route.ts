import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { deleteMediaFile } from "@/lib/storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const asset = await db.mediaAssets.findById(id);
  if (!asset) {
    return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  }

  const memberCheck = await requireWorkspaceMember(asset.workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  try {
    // Prevent deleting media assets still attached to any post — never touch cloud storage if in use
    const attachedPostCount = await prisma.postMedia.count({
      where: { mediaAssetId: id },
    });

    if (attachedPostCount > 0) {
      return NextResponse.json(
        {
          error: `This file is currently attached to ${attachedPostCount} post${attachedPostCount === 1 ? "" : "s"}. Remove it from those posts before deleting.`,
          code: "MEDIA_IN_USE",
          attachedPostCount,
        },
        { status: 409 }
      );
    }

    // Delete the DB record FIRST so a DB constraint error never destroys the live cloud storage object
    await db.mediaAssets.delete(id);

    // Clean up physical file in cloud storage after DB deletion succeeds
    try {
      await deleteMediaFile(asset.storageKey);
    } catch (storageErr) {
      console.error(
        "[Media Delete] DB row deleted but cloud storage cleanup failed:",
        asset.storageKey,
        storageErr
      );
    }

    await db.activity.log({
      workspaceId: asset.workspaceId,
      userId: auth.user.id,
      action: "MEDIA_DELETED",
      entityType: "MEDIA_ASSET",
      entityId: id,
      metadata: { fileName: asset.fileName },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to delete media asset" },
      { status: 500 }
    );
  }
}
