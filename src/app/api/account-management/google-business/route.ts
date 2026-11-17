import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  requireWorkspaceSocialAccount,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";
import { gbpPatchSchema, parseJsonBody } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const socialAccountId = searchParams.get("socialAccountId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  try {
    let targetAccountId = socialAccountId;

    if (targetAccountId) {
      const ownership = await requireWorkspaceSocialAccount(
        workspaceId,
        targetAccountId,
        "GOOGLE_BUSINESS"
      );
      if (ownership.error) return ownership.error;
    } else {
      const accounts = await db.socialAccounts.listForWorkspace(workspaceId);
      const gbpAccount = accounts.find((a) => a.platform === "GOOGLE_BUSINESS");
      if (!gbpAccount) {
        return NextResponse.json({
          location: null,
          message: "No Google Business Profile account connected in this workspace.",
        });
      }
      targetAccountId = gbpAccount.id;
    }

    const location = await GoogleBusinessManagementService.getOrCreateLocation(targetAccountId);
    return NextResponse.json({ location });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to fetch Google Business Profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, gbpPatchSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, socialAccountId, action, data } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const ownership = await requireWorkspaceSocialAccount(
    workspaceId,
    socialAccountId,
    "GOOGLE_BUSINESS"
  );
  if (ownership.error) return ownership.error;

  try {
    if (action === "update_info") {
      const updated = await GoogleBusinessManagementService.updateInfo(
        socialAccountId,
        auth.user.id,
        workspaceId,
        data as Parameters<typeof GoogleBusinessManagementService.updateInfo>[3]
      );
      return NextResponse.json({ success: true, location: updated });
    }

    if (action === "update_hours") {
      const updated = await GoogleBusinessManagementService.updateHours(
        socialAccountId,
        auth.user.id,
        workspaceId,
        (data.regularHours as Parameters<typeof GoogleBusinessManagementService.updateHours>[3]) || [],
        (data.specialHours as Parameters<typeof GoogleBusinessManagementService.updateHours>[4]) || []
      );
      return NextResponse.json({ success: true, location: updated });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update location" }, { status: 500 });
  }
}
