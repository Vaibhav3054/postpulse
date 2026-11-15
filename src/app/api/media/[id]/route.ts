import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteMediaFile } from "@/lib/storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const asset = await db.mediaAssets.findById(id);
  if (!asset) {
    return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
  }

  const membership = await db.workspaces.checkMembership(asset.workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
  }

  try {
    await deleteMediaFile(asset.storageKey);
    await db.mediaAssets.delete(id);

    await db.activity.log({
      workspaceId: asset.workspaceId,
      userId: session.id,
      action: "MEDIA_DELETED",
      entityType: "MEDIA_ASSET",
      entityId: id,
      metadata: { fileName: asset.fileName },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete media asset" }, { status: 500 });
  }
}
