import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
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
    const failedTargets = post.platformTargets.filter((t) => t.status === "FAILED");
    if (failedTargets.length === 0) {
      return NextResponse.json({ message: "No failed platform targets to retry." });
    }

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
