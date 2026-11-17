import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
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
    await deleteMediaFile(asset.storageKey);
    await db.mediaAssets.delete(id);

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
    return NextResponse.json({ error: error.message || "Failed to delete media asset" }, { status: 500 });
  }
}
