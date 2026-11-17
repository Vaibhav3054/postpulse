import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  verifyWorkspaceMediaAssets,
  verifyWorkspaceSocialAccounts,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { executePublishJob } from "@/lib/queue/publishing-queue";
import { QuotaExceededError } from "@/lib/quota";
import { parseJsonBody, postCreateSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const status = searchParams.get("status") || "ALL";
  const platform = searchParams.get("platform") || "ALL";
  const rawLimit = searchParams.get("limit");
  const cursor = searchParams.get("cursor") || undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

  const result = await db.posts.listPaginatedForWorkspace(workspaceId, {
    status,
    platform,
    limit,
    cursor,
  });

  return NextResponse.json({
    posts: result.items,
    pagination: result.pagination,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const clientIp = getClientIp(req);
  const rateResult = await checkRateLimit(
    `posts:create:${auth.user.id}:${clientIp}`,
    60,
    10 * 60 * 1000
  );
  if (!rateResult.allowed) {
    return rateLimitExceededResponse(rateResult, "Too many post creation requests. Please wait.");
  }

  const parsed = await parseJsonBody(req, postCreateSchema);
  if (parsed.error) return parsed.error;

  const {
    workspaceId,
    status,
    commonCaption,
    scheduledAt,
    timezone,
    mediaAssetIds,
    targets,
  } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  // Tenant isolation: verify every referenced socialAccountId belongs to workspaceId
  const accountsCheck = await verifyWorkspaceSocialAccounts(
    workspaceId,
    targets.map((t) => t.socialAccountId)
  );
  if (!accountsCheck.ok) return accountsCheck.error;

  // Tenant isolation: verify every referenced mediaAssetId belongs to workspaceId
  if (mediaAssetIds.length > 0) {
    const mediaCheck = await verifyWorkspaceMediaAssets(workspaceId, mediaAssetIds);
    if (!mediaCheck.ok) return mediaCheck.error;
  }

  try {
    const post = await db.posts.create({
      workspaceId,
      createdByUserId: auth.user.id,
      status: status || "DRAFT",
      commonCaption: commonCaption || "",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      timezone: timezone || "UTC",
      mediaAssetIds,
      targets,
    });

    await db.activity.log({
      workspaceId,
      userId: auth.user.id,
      action:
        status === "PUBLISHED"
          ? "POST_PUBLISHED"
          : status === "SCHEDULED"
            ? "POST_SCHEDULED"
            : "POST_DRAFTED",
      entityType: "POST",
      entityId: post.id,
      metadata: {
        status: post.status,
        scheduledAt: post.scheduledAt,
        targetCount: targets.length,
      },
    });

    // If publishing immediately, execute publish for each target right away
    if (status === "PUBLISHED") {
      for (const target of post.platformTargets) {
        await executePublishJob({
          postId: post.id,
          targetId: target.id,
          workspaceId,
          socialAccountId: target.socialAccountId,
          platform: target.platform,
          attempt: 1,
        });
      }
    }

    const freshPost = await db.posts.findById(post.id);
    return NextResponse.json({ post: freshPost }, { status: 201 });
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
    return NextResponse.json({ error: error.message || "Failed to create post" }, { status: 500 });
  }
}
