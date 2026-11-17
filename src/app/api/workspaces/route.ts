import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/authorization";
import { db } from "@/lib/db";
import { QuotaExceededError } from "@/lib/quota";
import { parseJsonBody, workspaceCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const workspaces = await db.workspaces.listForUser(auth.user.id);
  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, workspaceCreateSchema);
  if (parsed.error) return parsed.error;

  const { name, slug } = parsed.data;

  try {
    const calculatedSlug =
      (slug?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) ||
      "workspace";
    const workspace = await db.workspaces.create({
      name,
      slug: calculatedSlug,
      ownerId: auth.user.id,
    });

    await db.activity.log({
      workspaceId: workspace.id,
      userId: auth.user.id,
      action: "WORKSPACE_CREATED",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      metadata: { name: workspace.name, slug: workspace.slug },
    });

    return NextResponse.json({ workspace }, { status: 201 });
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
    return NextResponse.json({ error: error.message || "Failed to create workspace" }, { status: 500 });
  }
}
