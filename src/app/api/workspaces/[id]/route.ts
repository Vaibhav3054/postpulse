import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { parseJsonBody, workspaceUpdateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const memberCheck = await requireWorkspaceMember(id, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const parsed = await parseJsonBody(req, workspaceUpdateSchema);
  if (parsed.error) return parsed.error;

  try {
    const updated = await db.workspaces.update(id, { name: parsed.data.name });
    await db.activity.log({
      workspaceId: id,
      userId: auth.user.id,
      action: "WORKSPACE_RENAMED",
      entityType: "WORKSPACE",
      entityId: id,
      metadata: { newName: parsed.data.name },
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
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const memberCheck = await requireWorkspaceMember(id, auth.user.id, ["OWNER"]);
  if (memberCheck.error) return memberCheck.error;

  try {
    await db.workspaces.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete workspace" }, { status: 500 });
  }
}
