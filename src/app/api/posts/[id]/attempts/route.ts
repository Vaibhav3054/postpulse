import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      scheduledAt: true,
      timezone: true,
      publishedAt: true,
      platformTargets: {
        select: {
          id: true,
          platform: true,
          status: true,
          externalPostId: true,
          externalPostUrl: true,
          errorMessage: true,
          retryCount: true,
          maxRetries: true,
          nextRetryAt: true,
          isMockPublish: true,
          publishedAt: true,
          publishAttempts: {
            orderBy: { executedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const memberCheck = await requireWorkspaceMember(post.workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  return NextResponse.json({
    postId: post.id,
    status: post.status,
    scheduledAt: post.scheduledAt,
    timezone: post.timezone,
    publishedAt: post.publishedAt,
    targets: post.platformTargets,
  });
}
