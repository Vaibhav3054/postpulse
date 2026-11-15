import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUploadUrl } from "@/lib/storage";
import { SUBSCRIPTION_PLANS, QuotaExceededError } from "@/lib/quota";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, fileName, mimeType, fileSizeBytes } = await req.json();

    if (!workspaceId || !fileName || !mimeType) {
      return NextResponse.json(
        { error: "workspaceId, fileName, and mimeType are required." },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
    }

    // Quota check: Total storage in MB
    const ws = await db.workspaces.findById(workspaceId);
    const plan = SUBSCRIPTION_PLANS[ws?.planId || "free"];
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
