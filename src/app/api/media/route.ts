import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const membership = await db.workspaces.checkMembership(workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
  }

  const media = await db.mediaAssets.listForWorkspace(workspaceId);
  return NextResponse.json({ media });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      workspaceId,
      fileName,
      storageKey,
      publicUrl,
      mediaType,
      mimeType,
      fileSizeBytes,
      width,
      height,
      durationSeconds,
    } = await req.json();

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
    }

    const asset = await db.mediaAssets.create({
      workspaceId,
      fileName,
      storageKey,
      publicUrl,
      mediaType: mediaType || (mimeType?.startsWith("video/") ? "VIDEO" : "IMAGE"),
      mimeType: mimeType || "image/jpeg",
      fileSizeBytes: fileSizeBytes || 0,
      width,
      height,
      durationSeconds,
      isTemporary: false,
    });

    await db.activity.log({
      workspaceId,
      userId: session.id,
      action: "MEDIA_UPLOADED",
      entityType: "MEDIA_ASSET",
      entityId: asset.id,
      metadata: { fileName: asset.fileName, mediaType: asset.mediaType },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to save media asset" }, { status: 500 });
  }
}
