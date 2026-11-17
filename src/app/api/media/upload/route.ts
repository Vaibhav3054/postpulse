import { NextRequest, NextResponse } from "next/server";
import { saveMediaFile, StorageConfigurationError } from "@/lib/storage";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveWorkspacePlan, QuotaExceededError } from "@/lib/quota";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  getMaxSizeForMime,
  hasValidMediaMagicBytes,
  parseAndValidateStorageKey,
} from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function PUT(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const clientIp = getClientIp(req);
  const rateResult = await checkRateLimit(
    `media:upload:${auth.user.id}:${clientIp}`,
    60,
    10 * 60 * 1000
  );
  if (!rateResult.allowed) {
    return rateLimitExceededResponse(rateResult, "Too many file uploads. Please wait and try again.");
  }

  try {
    const { searchParams } = new URL(req.url);
    const storageKey = searchParams.get("key") || "";
    const rawMime = (
      searchParams.get("mime") ||
      req.headers.get("content-type") ||
      "image/jpeg"
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    const parsedKey = parseAndValidateStorageKey(storageKey);
    if (!parsedKey.valid || !parsedKey.workspaceId) {
      return NextResponse.json(
        { error: "Invalid storage key format." },
        { status: 400 }
      );
    }

    const memberCheck = await requireWorkspaceMember(parsedKey.workspaceId, auth.user.id);
    if (memberCheck.error) return memberCheck.error;

    if (!ALLOWED_MEDIA_MIME_TYPES.has(rawMime)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${rawMime}. Allowed types: JPEG, PNG, WebP, GIF, MP4, MOV, WebM.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    const maxBytes = getMaxSizeForMime(rawMime);
    if (buffer.length > maxBytes) {
      return NextResponse.json(
        {
          error: `File exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))} MB).`,
        },
        { status: 413 }
      );
    }

    // Verify actual file magic bytes match declared MIME type
    if (!hasValidMediaMagicBytes(buffer, rawMime)) {
      return NextResponse.json(
        {
          error: `File content does not match declared file type (${rawMime}). Upload rejected for security.`,
        },
        { status: 400 }
      );
    }

    // Enforce workspace storage quota against actual uploaded byte length
    const ws = await db.workspaces.findById(parsedKey.workspaceId);
    const plan = resolveWorkspacePlan(ws?.plan);
    const existingMedia = await db.mediaAssets.listForWorkspace(parsedKey.workspaceId);
    const totalStorageBytes = existingMedia.reduce((acc, m) => acc + (m.fileSizeBytes || 0), 0);
    const maxStorageBytes = plan.maxStorageMb * 1024 * 1024;

    if (totalStorageBytes + buffer.length > maxStorageBytes) {
      const currentMb = Number((totalStorageBytes / (1024 * 1024)).toFixed(1));
      throw new QuotaExceededError("storage_mb", plan.maxStorageMb, currentMb, plan.code);
    }

    const publicUrl = await saveMediaFile(storageKey, buffer, rawMime);

    return NextResponse.json({
      success: true,
      publicUrl,
      fileSizeBytes: buffer.length,
    });
  } catch (err: unknown) {
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
    if (err instanceof StorageConfigurationError) {
      return NextResponse.json(
        { error: err.message, code: "STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to save file" }, { status: 500 });
  }
}
