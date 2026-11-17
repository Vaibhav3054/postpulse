import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { executePublishJob } from "@/lib/queue/publishing-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const post = await db.posts.findById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const memberCheck = await requireWorkspaceMember(post.workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  try {
    // Only retry FAILED targets that have NEVER received an externalPostId (strict duplicate prevention)
    const failedTargets = post.platformTargets.filter(
      (t) => t.status === "FAILED" && !t.externalPostId
    );
    if (failedTargets.length === 0) {
      return NextResponse.json({ message: "No failed platform targets eligible to retry." });
    }

    await db.posts.update(id, { status: "PUBLISHING" });

    const outcomes = [];
    for (const target of failedTargets) {
      // Allow manual retry even if previous automatic retries were exhausted
      await prisma.postPlatformTarget.update({
        where: { id: target.id },
        data: { nextRetryAt: null },
      });

      const outcome = await executePublishJob({
        postId: post.id,
        targetId: target.id,
        workspaceId: post.workspaceId,
        socialAccountId: target.socialAccountId,
        platform: target.platform,
        forceManualRetry: true,
      });
      outcomes.push(outcome);
    }

    const freshPost = await db.posts.findById(id);
    return NextResponse.json({ post: freshPost, outcomes });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to retry post" }, { status: 500 });
  }
}
