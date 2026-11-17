import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { consumeOAuthState } from "@/lib/social-providers/oauth-service";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { QuotaExceededError } from "@/lib/quota";

const PROVIDER_SLUG_TO_ALLOWED_PLATFORMS: Record<string, SocialPlatformType[]> = {
  google: ["GOOGLE_BUSINESS", "YOUTUBE"],
  "google-business": ["GOOGLE_BUSINESS"],
  youtube: ["YOUTUBE"],
  meta: ["FACEBOOK", "INSTAGRAM"],
  facebook: ["FACEBOOK"],
  instagram: ["INSTAGRAM"],
  linkedin: ["LINKEDIN"],
};

/**
 * Official OAuth 2.0 Callback Handler:
 *  - /api/auth/callback/google   (Google Business Profile & YouTube)
 *  - /api/auth/callback/meta     (Facebook Pages & Instagram Professional)
 *  - /api/auth/callback/linkedin (LinkedIn Profile & Organization Pages)
 *
 * Enforces server-side CSRF state validation (one-time use), user identity match,
 * OWNER/ADMIN role check, and AES-256-GCM encrypted token storage.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerSlug } = await params;
  const normalizedSlug = providerSlug.toLowerCase();
  const allowedPlatforms = PROVIDER_SLUG_TO_ALLOWED_PLATFORMS[normalizedSlug];

  if (!allowedPlatforms) {
    return NextResponse.json(
      { error: `Unsupported OAuth provider callback: ${providerSlug}` },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");

  const auth = await requireApiSession(req);
  if (auth.error) {
    return NextResponse.redirect(new URL("/login?error=session_required_for_oauth", req.url));
  }

  if (!state) {
    return NextResponse.json(
      { error: "Missing OAuth state parameter (CSRF protection)." },
      { status: 400 }
    );
  }

  // Atomically validate and consume one-time CSRF state token
  const oauthState = await consumeOAuthState(state);
  if (!oauthState) {
    return NextResponse.json(
      {
        error:
          "Invalid, expired, or already-used OAuth state token. Please restart the connection flow.",
      },
      { status: 400 }
    );
  }

  const workspace = await db.workspaces.findById(oauthState.workspaceId);
  const fallbackRedirectBase = workspace
    ? `/app/${workspace.slug}/social-accounts`
    : "/app";

  // Verify the callback provider route matches the platform recorded in the server-side CSRF state
  if (!allowedPlatforms.includes(oauthState.platform as SocialPlatformType)) {
    return NextResponse.json(
      { error: "OAuth provider mismatch against CSRF state." },
      { status: 400 }
    );
  }

  // Verify the authenticated browser user matches the user who initiated OAuth
  if (oauthState.userId !== auth.user.id) {
    return NextResponse.json(
      { error: "Forbidden: OAuth session user does not match state initiator." },
      { status: 403 }
    );
  }

  // Verify workspace OWNER/ADMIN permission
  const memberCheck = await requireWorkspaceMember(oauthState.workspaceId, auth.user.id, [
    "OWNER",
    "ADMIN",
  ]);
  if (memberCheck.error) return memberCheck.error;

  if (oauthError) {
    const msg = oauthErrorDesc || oauthError;
    return NextResponse.redirect(
      new URL(`${fallbackRedirectBase}?error=${encodeURIComponent(msg)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `${fallbackRedirectBase}?error=${encodeURIComponent("Authorization code was not returned by provider.")}`,
        req.url
      )
    );
  }

  try {
    const socialProvider = getSocialProvider(oauthState.platform as SocialPlatformType);
    const result = await socialProvider.handleCallback(code, oauthState.redirectUri);

    const savedAccount = await db.socialAccounts.create({
      workspaceId: oauthState.workspaceId,
      platform: oauthState.platform as SocialPlatformType,
      platformAccountId: result.account.platformAccountId,
      platformUsername: result.account.platformUsername,
      platformDisplayName: result.account.platformDisplayName,
      avatarUrl: result.account.avatarUrl || "",
      accessTokenEncrypted: encryptToken(result.accessToken),
      refreshTokenEncrypted: result.refreshToken
        ? encryptToken(result.refreshToken)
        : undefined,
      tokenExpiresAt: result.tokenExpiresAt,
      scopes: result.scopes,
      metadata: {
        ...(result.account.metadata || {}),
        isMock: false,
        connectionMode: "live",
        needsReauth: false,
        connectedVia: `/api/auth/callback/${normalizedSlug}`,
        lastVerifiedAt: new Date().toISOString(),
      },
      isActive: true,
    });

    await db.activity.log({
      workspaceId: oauthState.workspaceId,
      userId: auth.user.id,
      action: "SOCIAL_ACCOUNT_CONNECTED_LIVE",
      entityType: "SOCIAL_ACCOUNT",
      entityId: savedAccount.id,
      metadata: {
        platform: oauthState.platform,
        username: result.account.platformUsername,
        connectionMode: "live",
        scopes: result.scopes,
      },
    });

    return NextResponse.redirect(
      new URL(
        `${fallbackRedirectBase}?connected=${encodeURIComponent(oauthState.platform)}&mode=live`,
        req.url
      )
    );
  } catch (err: unknown) {
    const message =
      err instanceof QuotaExceededError
        ? err.message
        : (err as Error).message || "OAuth token exchange failed.";

    return NextResponse.redirect(
      new URL(`${fallbackRedirectBase}?error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
