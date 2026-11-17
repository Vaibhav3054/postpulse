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
    const { workspaceId, socialAccountId, reviewId, replyText } = await req.json();

    if (!workspaceId || !socialAccountId || !reviewId || !replyText?.trim()) {
      return NextResponse.json(
        { error: "workspaceId, socialAccountId, reviewId, and replyText are required" },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can reply to customer reviews" },
        { status: 403 }
      );
    }

    const review = await GoogleBusinessManagementService.replyToReview(
      socialAccountId,
      session.id,
      workspaceId,
      reviewId,
      replyText.trim()
    );

    return NextResponse.json({ success: true, review });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to reply to review" }, { status: 500 });
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
    const reviewId = searchParams.get("reviewId");

    if (!workspaceId || !socialAccountId || !reviewId) {
      return NextResponse.json(
        { error: "workspaceId, socialAccountId, and reviewId are required" },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can delete review replies" },
        { status: 403 }
      );
    }

    const review = await GoogleBusinessManagementService.deleteReviewReply(
      socialAccountId,
      session.id,
      workspaceId,
      reviewId
    );

    return NextResponse.json({ success: true, review });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete review reply" }, { status: 500 });
  }
}
