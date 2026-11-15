import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { executePublishJob } from "@/lib/queue/publishing-queue";
import { QuotaExceededError } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const status = searchParams.get("status") || "ALL";
  const platform = searchParams.get("platform") || "ALL";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const membership = await db.workspaces.checkMembership(workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
  }

  const posts = await db.posts.listForWorkspace(workspaceId, { status, platform });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      workspaceId,
      status, // "DRAFT" | "SCHEDULED" | "PUBLISHED"
      commonCaption,
      scheduledAt,
      timezone,
      mediaAssetIds,
      targets,
    } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: "At least one social account target is required." }, { status: 400 });
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
    }

    const post = await db.posts.create({
      workspaceId,
      createdByUserId: session.id,
      status: status || "DRAFT",
      commonCaption: commonCaption || "",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      timezone: timezone || "UTC",
      mediaAssetIds: mediaAssetIds || [],
      targets,
    });

    await db.activity.log({
      workspaceId,
      userId: session.id,
      action: status === "PUBLISHED" ? "POST_PUBLISHED" : status === "SCHEDULED" ? "POST_SCHEDULED" : "POST_DRAFTED",
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
