import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  verifyWorkspaceMediaAssets,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { parseJsonBody, postUpdateSchema } from "@/lib/validation";

export async function GET(
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

  return NextResponse.json({ post });
}

export async function PATCH(
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

  const parsed = await parseJsonBody(req, postUpdateSchema);
  if (parsed.error) return parsed.error;

  const body = parsed.data;

  // Tenant isolation: verify any updated mediaAssetIds belong strictly to post.workspaceId
  if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
    const mediaCheck = await verifyWorkspaceMediaAssets(post.workspaceId, body.mediaAssetIds);
    if (!mediaCheck.ok) return mediaCheck.error;
  }

  try {
    const updateData: Record<string, unknown> = {};

    if (body.commonCaption !== undefined) updateData.commonCaption = body.commonCaption;
    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
    }
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.mediaAssetIds !== undefined) updateData.mediaAssetIds = body.mediaAssetIds;

    await db.posts.update(id, updateData);

    await db.activity.log({
      workspaceId: post.workspaceId,
      userId: auth.user.id,
      action: "POST_UPDATED",
      entityType: "POST",
      entityId: id,
      metadata: updateData,
    });

    const fresh = await db.posts.findById(id);
    return NextResponse.json({ post: fresh });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(
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
    await db.posts.delete(id);
    await db.activity.log({
      workspaceId: post.workspaceId,
      userId: auth.user.id,
      action: "POST_DELETED",
      entityType: "POST",
      entityId: id,
      metadata: { previousStatus: post.status },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete post" }, { status: 500 });
  }
}
