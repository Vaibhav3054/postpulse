import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { encryptToken } from "@/lib/crypto";
import { QuotaExceededError } from "@/lib/quota";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const membership = await db.workspaces.checkMembership(workspaceId, session.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
  }

  const accounts = await db.socialAccounts.listForWorkspace(workspaceId);
  // Never expose raw or encrypted access tokens to the frontend
  const safeAccounts = accounts.map(({ accessTokenEncrypted, refreshTokenEncrypted, ...safe }) => safe);

  return NextResponse.json({ accounts: safeAccounts });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId, platform, mockCode } = await req.json();

    if (!workspaceId || !platform) {
      return NextResponse.json({ error: "workspaceId and platform are required." }, { status: 400 });
    }

    const membership = await db.workspaces.checkMembership(workspaceId, session.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a member of this workspace." }, { status: 403 });
    }

    const provider = getSocialProvider(platform as SocialPlatformType);
    const connectResult = await provider.handleCallback(
      mockCode || `mock_code_${Date.now()}`,
      `${process.env.APP_URL || "http://localhost:3000"}/api/social-accounts/oauth/callback`
    );

    const newAccount = await db.socialAccounts.create({
      workspaceId,
      platform: platform as SocialPlatformType,
      platformAccountId: connectResult.account.platformAccountId,
      platformUsername: connectResult.account.platformUsername,
      platformDisplayName: connectResult.account.platformDisplayName,
      avatarUrl: connectResult.account.avatarUrl || "",
      accessTokenEncrypted: encryptToken(connectResult.accessToken),
      refreshTokenEncrypted: connectResult.refreshToken ? encryptToken(connectResult.refreshToken) : undefined,
      tokenExpiresAt: connectResult.tokenExpiresAt,
      scopes: connectResult.scopes,
      metadata: connectResult.account.metadata || {},
      isActive: true,
    });

    await db.activity.log({
      workspaceId,
      userId: session.id,
      action: "SOCIAL_ACCOUNT_CONNECTED",
      entityType: "SOCIAL_ACCOUNT",
      entityId: newAccount.id,
      metadata: {
        platform: newAccount.platform,
        username: newAccount.platformUsername,
        displayName: newAccount.platformDisplayName,
      },
    });

    const { accessTokenEncrypted, refreshTokenEncrypted, ...safeAccount } = newAccount;
    return NextResponse.json({ account: safeAccount }, { status: 201 });
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
    return NextResponse.json({ error: error.message || "Failed to connect social account" }, { status: 500 });
  }
}
