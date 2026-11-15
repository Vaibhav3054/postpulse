import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { executePublishJob } from "@/lib/queue/publishing-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await db.posts.findById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const membership = await db.workspaces.checkMembership(post.workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
  }

  try {
    const failedTargets = post.platformTargets.filter((t) => t.status === "FAILED");
    if (failedTargets.length === 0) {
      return NextResponse.json({ message: "No failed platform targets to retry." });
    }

    // Set post status back to publishing
    await db.posts.update(id, { status: "PUBLISHING" });

    for (const target of failedTargets) {
      await executePublishJob({
        postId: post.id,
        targetId: target.id,
        workspaceId: post.workspaceId,
        socialAccountId: target.socialAccountId,
        platform: target.platform,
        attempt: 2,
      });
    }

    const freshPost = await db.posts.findById(id);
    return NextResponse.json({ post: freshPost });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to retry post" }, { status: 500 });
  }
}
