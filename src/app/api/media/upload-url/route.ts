import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { generateUploadUrl } from "@/lib/storage";
import { SUBSCRIPTION_PLANS, QuotaExceededError } from "@/lib/quota";
import { mediaUploadUrlSchema, parseJsonBody } from "@/lib/validation";
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

  const { workspaceId, fileName, mimeType } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  try {
    // Quota check: Total storage in MB
    const ws = await db.workspaces.findById(workspaceId);
    const plan = SUBSCRIPTION_PLANS[ws?.planId || "free"] || SUBSCRIPTION_PLANS.free;
    const existingMedia = await db.mediaAssets.listForWorkspace(workspaceId);
    const totalStorageBytes = existingMedia.reduce((acc, m) => acc + m.fileSizeBytes, 0);
    const totalStorageMb = Math.round(totalStorageBytes / (1024 * 1024));

    if (totalStorageMb >= plan.maxStorageMb) {
      throw new QuotaExceededError("storage_mb", plan.maxStorageMb, totalStorageMb, plan.code);
    }

    const uploadData = await generateUploadUrl(workspaceId, fileName, mimeType);

    return NextResponse.json(uploadData);
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
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to generate upload URL" }, { status: 500 });
  }
}
