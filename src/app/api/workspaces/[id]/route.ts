import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await db.workspaces.checkMembership(id, session.id);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: Admin or Owner role required." }, { status: 403 });
  }

  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const updated = await db.workspaces.update(id, { name });
    await db.activity.log({
      workspaceId: id,
      userId: session.id,
      action: "WORKSPACE_RENAMED",
      entityType: "WORKSPACE",
      entityId: id,
      metadata: { newName: name },
    });

    return NextResponse.json({ workspace: updated });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update workspace" }, { status: 500 });
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
  const membership = await db.workspaces.checkMembership(id, session.id);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden: Only the Workspace Owner can delete it." }, { status: 403 });
  }

  try {
    await db.workspaces.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete workspace" }, { status: 500 });
  }
}
