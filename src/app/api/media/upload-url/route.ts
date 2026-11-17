import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { generateUploadUrl, StorageConfigurationError } from "@/lib/storage";
import { resolveWorkspacePlan, QuotaExceededError } from "@/lib/quota";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  getMaxSizeForMime,
  mediaUploadUrlSchema,
  parseJsonBody,
} from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const clientIp = getClientIp(req);
  const rateResult = await checkRateLimit(
    `media:upload-url:${auth.user.id}:${clientIp}`,
    60,
    10 * 60 * 1000
  );
  if (!rateResult.allowed) {
    return rateLimitExceededResponse(rateResult, "Too many upload requests. Please wait.");
  }

  const parsed = await parseJsonBody(req, mediaUploadUrlSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, fileName, fileSizeBytes } = parsed.data;
  const normalizedMime = parsed.data.mimeType.split(";")[0].trim().toLowerCase();

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  if (!ALLOWED_MEDIA_MIME_TYPES.has(normalizedMime)) {
    return NextResponse.json(
      {
        error: `Unsupported file type "${normalizedMime}". Allowed types: JPEG, PNG, WebP, GIF, MP4, MOV, WebM.`,
      },
      { status: 400 }
    );
  }

  const maxFileBytes = getMaxSizeForMime(normalizedMime);
  const incomingBytes = fileSizeBytes ?? 0;
  if (incomingBytes > maxFileBytes) {
    return NextResponse.json(
      {
        error: `File exceeds the maximum allowed size (${Math.round(maxFileBytes / (1024 * 1024))} MB) for ${normalizedMime.startsWith("video/") ? "videos" : "images"}.`,
      },
      { status: 413 }
    );
  }

  try {
    const ws = await db.workspaces.findById(workspaceId);
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    const plan = resolveWorkspacePlan(ws.plan);
    const maxStorageBytes = plan.maxStorageMb * 1024 * 1024;
    const existingMedia = await db.mediaAssets.listForWorkspace(workspaceId);
    const totalStorageBytes = existingMedia.reduce((acc, m) => acc + (m.fileSizeBytes || 0), 0);

    if (totalStorageBytes + incomingBytes > maxStorageBytes) {
      const currentMb = Number((totalStorageBytes / (1024 * 1024)).toFixed(1));
      throw new QuotaExceededError("storage_mb", plan.maxStorageMb, currentMb, plan.code);
    }

    const uploadData = await generateUploadUrl(workspaceId, fileName, normalizedMime);

    return NextResponse.json({
      ...uploadData,
      maxFileSizeBytes: maxFileBytes,
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
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
