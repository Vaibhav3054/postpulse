import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, socialAccountId, photo } = await req.json();

    if (!workspaceId || !socialAccountId || !photo?.url) {
      return NextResponse.json(
        { error: "workspaceId, socialAccountId, and photo.url are required" },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can upload business photos" },
        { status: 403 }
      );
    }

    const location = await GoogleBusinessManagementService.addPhoto(
      socialAccountId,
      session.id,
      workspaceId,
      photo
    );

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to add photo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const socialAccountId = searchParams.get("socialAccountId");
    const photoId = searchParams.get("photoId");

    if (!workspaceId || !socialAccountId || !photoId) {
      return NextResponse.json(
        { error: "workspaceId, socialAccountId, and photoId are required" },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can delete business photos" },
        { status: 403 }
      );
    }

    const location = await GoogleBusinessManagementService.deletePhoto(
      socialAccountId,
      session.id,
      workspaceId,
      photoId
    );

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete photo" }, { status: 500 });
  }
}
