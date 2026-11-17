import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  requireWorkspaceSocialAccount,
} from "@/lib/authorization";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";
import { gbpPhotoAddSchema, parseJsonBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, gbpPhotoAddSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, socialAccountId, photo } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const ownership = await requireWorkspaceSocialAccount(
    workspaceId,
    socialAccountId,
    "GOOGLE_BUSINESS"
  );
  if (ownership.error) return ownership.error;

  try {
    const location = await GoogleBusinessManagementService.addPhoto(
      socialAccountId,
      auth.user.id,
      workspaceId,
      {
        url: photo.url,
        category: photo.category || "ADDITIONAL",
        caption: photo.caption,
      }
    );

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to add photo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

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

    const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
    if (memberCheck.error) return memberCheck.error;

    const ownership = await requireWorkspaceSocialAccount(
      workspaceId,
      socialAccountId,
      "GOOGLE_BUSINESS"
    );
    if (ownership.error) return ownership.error;

    const location = await GoogleBusinessManagementService.deletePhoto(
      socialAccountId,
      auth.user.id,
      workspaceId,
      photoId
    );

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to delete photo" }, { status: 500 });
  }
}
