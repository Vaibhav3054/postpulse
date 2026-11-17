import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoogleBusinessManagementService } from "@/lib/account-management/google-business.service";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const socialAccountId = searchParams.get("socialAccountId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const membership = await db.workspaces.checkMembership(workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
  }

  try {
    // If specific socialAccountId provided, load it
    let targetAccountId = socialAccountId;

    // Otherwise find the first active GOOGLE_BUSINESS account in this workspace
    if (!targetAccountId) {
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
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { workspaceId, socialAccountId, action, data } = body;

    if (!workspaceId || !socialAccountId || !action) {
      return NextResponse.json(
        { error: "workspaceId, socialAccountId, and action are required" },
        { status: 400 }
      );
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Owner or Admin can update account business details" },
        { status: 403 }
      );
    }

    if (action === "update_info") {
      const updated = await GoogleBusinessManagementService.updateInfo(
        socialAccountId,
        session.id,
        workspaceId,
        data
      );
      return NextResponse.json({ success: true, location: updated });
    }

    if (action === "update_hours") {
      const updated = await GoogleBusinessManagementService.updateHours(
        socialAccountId,
        session.id,
        workspaceId,
        data.regularHours,
        data.specialHours
      );
      return NextResponse.json({ success: true, location: updated });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to update location" }, { status: 500 });
  }
}
