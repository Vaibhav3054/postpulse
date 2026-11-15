import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
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

  return NextResponse.json({ post });
}

export async function PATCH(
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
    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.commonCaption !== undefined) updateData.commonCaption = body.commonCaption;
    if (body.scheduledAt !== undefined) updateData.scheduledAt = new Date(body.scheduledAt);
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.mediaAssetIds !== undefined) updateData.mediaAssetIds = body.mediaAssetIds;

    const updated = await db.posts.update(id, updateData);

    await db.activity.log({
      workspaceId: post.workspaceId,
      userId: session.id,
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
    await db.posts.delete(id);
    await db.activity.log({
      workspaceId: post.workspaceId,
      userId: session.id,
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
