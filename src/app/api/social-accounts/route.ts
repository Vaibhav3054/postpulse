import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  requireWorkspaceMember,
  sanitizeSocialAccount,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { encryptToken } from "@/lib/crypto";
import { QuotaExceededError } from "@/lib/quota";
import { parseJsonBody, socialAccountConnectSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id);
  if (memberCheck.error) return memberCheck.error;

  const accounts = await db.socialAccounts.listForWorkspace(workspaceId);
  const safeAccounts = accounts.map((a) => sanitizeSocialAccount(a));

  return NextResponse.json({ accounts: safeAccounts });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody(req, socialAccountConnectSchema);
  if (parsed.error) return parsed.error;

  const { workspaceId, platform, mockCode } = parsed.data;

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  if (process.env.MOCK_SOCIAL_PROVIDERS === "false") {
    return NextResponse.json(
      {
        error:
          "Live OAuth is enabled. Connect accounts via /api/social-accounts/oauth/start instead of direct mock creation.",
        code: "LIVE_OAUTH_REQUIRED",
      },
      { status: 400 }
    );
  }

  try {
    const provider = getSocialProvider(platform as SocialPlatformType);
    const connectResult = await provider.handleCallback(
      mockCode || `mock_code_${Date.now()}`,
      `${process.env.APP_URL || "http://localhost:3000"}/api/auth/callback/${platform.toLowerCase()}`
    );

    const newAccount = await db.socialAccounts.create({
      workspaceId,
      platform: platform as SocialPlatformType,
      platformAccountId: connectResult.account.platformAccountId,
      platformUsername: connectResult.account.platformUsername,
      platformDisplayName: connectResult.account.platformDisplayName,
      avatarUrl: connectResult.account.avatarUrl || "",
      accessTokenEncrypted: encryptToken(connectResult.accessToken),
      refreshTokenEncrypted: connectResult.refreshToken
        ? encryptToken(connectResult.refreshToken)
        : undefined,
      tokenExpiresAt: connectResult.tokenExpiresAt,
      scopes: connectResult.scopes,
      metadata: {
        ...(connectResult.account.metadata || {}),
        isMock: true,
        connectionMode: "mock_sandbox",
        needsReauth: false,
      },
      isActive: true,
    });

    await db.activity.log({
      workspaceId,
      userId: auth.user.id,
      action: "SOCIAL_ACCOUNT_CONNECTED",
      entityType: "SOCIAL_ACCOUNT",
      entityId: newAccount.id,
      metadata: {
        platform: newAccount.platform,
        username: newAccount.platformUsername,
        displayName: newAccount.platformDisplayName,
      },
    });

    return NextResponse.json({ account: sanitizeSocialAccount(newAccount) }, { status: 201 });
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
    return NextResponse.json(
      { error: error.message || "Failed to connect social account" },
      { status: 500 }
    );
  }
}
