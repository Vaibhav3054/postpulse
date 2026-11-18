import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { encryptToken } from "@/lib/crypto";
import { getSocialPlatformFlags, resolvePlatformAvailability } from "@/lib/platform-flags";

const VALID_PLATFORMS = new Set<SocialPlatformType>([
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "LINKEDIN",
  "GOOGLE_BUSINESS",
]);

export async function GET(req: NextRequest) {
  if (process.env.MOCK_SOCIAL_PROVIDERS === "false") {
    return NextResponse.json(
      { error: "Mock OAuth callback is disabled when live social providers are enabled." },
      { status: 403 }
    );
  }

  const auth = await requireApiSession(req);
  if (auth.error) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform")?.toUpperCase() as SocialPlatformType;
  const state = searchParams.get("state"); // workspaceSlug or workspaceId

  if (!platform || !VALID_PLATFORMS.has(platform) || !state) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // Find workspace by slug or id
  let workspace = await db.workspaces.findBySlug(state);
  if (!workspace) {
    workspace = await db.workspaces.findById(state);
  }

  if (!workspace) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // Critical Tenant Isolation Check: verify user is an OWNER or ADMIN of the target workspace
  const memberCheck = await requireWorkspaceMember(workspace.id, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to connect accounts to this workspace." },
      { status: 403 }
    );
  }

  const flags = await getSocialPlatformFlags();
  const availability = resolvePlatformAvailability(flags, auth.user.systemRole)[platform];
  if (!availability.canConnect) {
    return NextResponse.json(
      {
        error: "This social media integration is coming soon and is currently disabled.",
        code: "PLATFORM_COMING_SOON",
        platform,
      },
      { status: 503 }
    );
  }

  try {
    const provider = getSocialProvider(platform);
    const result = await provider.handleCallback(`mock_code_${Date.now()}`, "");

    await db.socialAccounts.create({
      workspaceId: workspace.id,
      platform,
      platformAccountId: result.account.platformAccountId,
      platformUsername: result.account.platformUsername,
      platformDisplayName: result.account.platformDisplayName,
      avatarUrl: result.account.avatarUrl || "",
      accessTokenEncrypted: encryptToken(result.accessToken),
      refreshTokenEncrypted: result.refreshToken ? encryptToken(result.refreshToken) : undefined,
      tokenExpiresAt: result.tokenExpiresAt,
      scopes: result.scopes,
      metadata: {
        ...(result.account.metadata || {}),
        isMock: true,
      },
      isActive: true,
    });

    await db.activity.log({
      workspaceId: workspace.id,
      userId: auth.user.id,
      action: "SOCIAL_ACCOUNT_CONNECTED",
      entityType: "SOCIAL_ACCOUNT",
      metadata: { platform, username: result.account.platformUsername, isMock: true },
    });

    return NextResponse.redirect(
      new URL(`/app/${workspace.slug}/social-accounts?connected=${platform}`, req.url)
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.redirect(
      new URL(
        `/app/${workspace.slug}/social-accounts?error=${encodeURIComponent(error.message)}`,
        req.url
      )
    );
  }
}
