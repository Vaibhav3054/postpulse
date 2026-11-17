import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  requireWorkspaceSocialAccount,
} from "@/lib/authorization";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";
import { gbpReviewReplySchema, parseJsonBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, gbpReviewReplySchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, socialAccountId, reviewId, replyText } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const ownership = await requireWorkspaceSocialAccount(
    workspaceId,
    socialAccountId,
    "GOOGLE_BUSINESS"
  );
  if (ownership.error) return ownership.error;

  try {
    const review = await GoogleBusinessManagementService.replyToReview(
      socialAccountId,
      auth.user.id,
      workspaceId,
      reviewId,
      replyText
    );

    return NextResponse.json({ success: true, review });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to reply to review" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

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

    const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
    if (memberCheck.error) return memberCheck.error;

    const ownership = await requireWorkspaceSocialAccount(
      workspaceId,
      socialAccountId,
      "GOOGLE_BUSINESS"
    );
    if (ownership.error) return ownership.error;

    const review = await GoogleBusinessManagementService.deleteReviewReply(
      socialAccountId,
      auth.user.id,
      workspaceId,
      reviewId
    );

    return NextResponse.json({ success: true, review });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete review reply" }, { status: 500 });
  }
}
