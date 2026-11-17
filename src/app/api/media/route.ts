import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveWorkspacePlan, QuotaExceededError } from "@/lib/quota";
import {
  buildPublicUrlForStorageKey,
  deleteMediaFile,
  StorageConfigurationError,
} from "@/lib/storage";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  getMaxSizeForMime,
  mediaCreateSchema,
  parseAndValidateStorageKey,
  parseJsonBody,
} from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const rawLimit = searchParams.get("limit");
  const cursor = searchParams.get("cursor") || undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

  const result = await db.mediaAssets.listPaginatedForWorkspace(workspaceId, {
    limit,
    cursor,
  });

  return NextResponse.json({
    media: result.items,
    pagination: result.pagination,
  });
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

  const normalizedMime = (mimeType || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MEDIA_MIME_TYPES.has(normalizedMime)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${normalizedMime}.` },
      { status: 400 }
    );
  }

  const bytes = fileSizeBytes ?? 0;
  const maxBytes = getMaxSizeForMime(normalizedMime);
  if (bytes > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))} MB).` },
      { status: 413 }
    );
  }

  let canonicalPublicUrl: string;
  try {
    canonicalPublicUrl = buildPublicUrlForStorageKey(storageKey);
  } catch (err: unknown) {
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json(
        { error: err.message, code: "STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Invalid storage configuration" }, { status: 400 });
  }

  try {
    // Re-verify storage quota prior to persisting DB row
    const ws = await db.workspaces.findById(workspaceId);
    const plan = resolveWorkspacePlan(ws?.plan);
    const existingMedia = await db.mediaAssets.listForWorkspace(workspaceId);
    const totalStorageBytes = existingMedia.reduce((acc, m) => acc + (m.fileSizeBytes || 0), 0);
    const maxStorageBytes = plan.maxStorageMb * 1024 * 1024;

    if (totalStorageBytes + bytes > maxStorageBytes) {
      const currentMb = Number((totalStorageBytes / (1024 * 1024)).toFixed(1));
      throw new QuotaExceededError("storage_mb", plan.maxStorageMb, currentMb, plan.code);
    }

    const asset = await db.mediaAssets.create({
      workspaceId,
      fileName,
      storageKey,
      publicUrl: canonicalPublicUrl,
      mediaType: mediaType || (normalizedMime.startsWith("video/") ? "VIDEO" : "IMAGE"),
      mimeType: normalizedMime,
      fileSizeBytes: bytes,
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
      metadata: { fileName: asset.fileName, mediaType: asset.mediaType, fileSizeBytes: bytes },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err: unknown) {
    // Orphan prevention: if DB creation failed for a newly uploaded storageKey (not already persisted),
    // clean up the uploaded object in storage so failed DB writes don't leak orphaned files.
    const existingRow = await db.mediaAssets.findByStorageKey(storageKey).catch(() => null);
    if (!existingRow) {
      await deleteMediaFile(storageKey).catch((cleanupErr) => {
        console.error("[Media Cleanup] Failed to remove orphaned object:", storageKey, cleanupErr);
      });
    }

    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "QUOTA_EXCEEDED",
          resource: err.resource,
          limit: err.limit,
          current: err.current,
        },
        { status: 403 }
      );
    }

    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Failed to save media asset" },
      { status: 500 }
    );
  }
}
