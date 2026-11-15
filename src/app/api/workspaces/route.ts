import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuotaExceededError } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await db.workspaces.listForUser(session.id);
  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, slug } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const calculatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const workspace = await db.workspaces.create({
      name,
      slug: calculatedSlug,
      ownerId: session.id,
    });

    await db.activity.log({
      workspaceId: workspace.id,
      userId: session.id,
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
