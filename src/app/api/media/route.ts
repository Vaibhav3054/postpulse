import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  mediaCreateSchema,
  parseAndValidateStorageKey,
  parseJsonBody,
} from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const media = await db.mediaAssets.listForWorkspace(workspaceId);
  return NextResponse.json({ media });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, mediaCreateSchema);
  if (parsed.error) return parsed.error;

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
  } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const parsedKey = parseAndValidateStorageKey(storageKey);
  if (!parsedKey.valid || parsedKey.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Forbidden: storageKey does not belong to this workspace." },
      { status: 403 }
    );
  }

  try {
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
      userId: auth.user.id,
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
