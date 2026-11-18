import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { SocialPlatformType } from "@/lib/social-providers/types";
import {
  createOAuthState,
  getCallbackUriForPlatform,
  getProviderIntegrationStatus,
} from "@/lib/social-providers/oauth-service";
import { getSocialPlatformFlags, resolvePlatformAvailability } from "@/lib/platform-flags";

const VALID_PLATFORMS = new Set<SocialPlatformType>([
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "LINKEDIN",
  "GOOGLE_BUSINESS",
]);

/**
 * GET /api/social-accounts/oauth/start?workspaceId=...&platform=...
 *
 * Generates a CSRF-protected OAuth 2.0 authorization URL when live credentials are configured,
 * or transparently returns mock_sandbox status when third-party credentials are not yet set.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { searchParams, origin } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId")?.trim();
  const platform = searchParams.get("platform")?.trim().toUpperCase() as SocialPlatformType;
  const shouldRedirect = searchParams.get("redirect") === "1";

  if (!workspaceId || !platform || !VALID_PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "Valid workspaceId and platform are required." },
      { status: 400 }
    );
  }

  const memberCheck = await requireWorkspaceMember(workspaceId, auth.user.id, ["OWNER", "ADMIN"]);
  if (memberCheck.error) return memberCheck.error;

  const flags = await getSocialPlatformFlags();
  const availability = resolvePlatformAvailability(flags, auth.user.systemRole)[platform];
  if (!availability.canConnect) {
    return NextResponse.json(
      {
        error: "This social media integration is coming soon and is not open for connections yet.",
        code: "PLATFORM_COMING_SOON",
        platform,
      },
      { status: 503 }
    );
  }

  const status = getProviderIntegrationStatus(platform);
  const redirectUri = getCallbackUriForPlatform(platform, origin);

  if (status.mode === "mock_sandbox") {
    const mockAuthUrl = `/api/social-accounts/oauth/mock-callback?platform=${encodeURIComponent(
      platform
    )}&state=${encodeURIComponent(workspaceId)}`;

    return NextResponse.json({
      mode: "mock_sandbox",
      platform,
      isConfigured: status.isConfigured,
      missingEnvVars: status.missingEnvVars,
      callbackUri: redirectUri,
      mockAuthUrl,
      notice:
        "Live provider credentials are not active yet. Use Sandbox Test Mode for UI/workflow testing only.",
    });
  }

  // Live Official OAuth 2.0 Flow with server-side CSRF state
  const stateToken = await createOAuthState({
    workspaceId,
    userId: auth.user.id,
    platform,
    redirectUri,
  });

  const provider = getSocialProvider(platform);
  const authUrl = provider.getAuthUrl(stateToken, redirectUri);

  if (shouldRedirect) {
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.json({
    mode: "live",
    platform,
    isConfigured: true,
    callbackUri: redirectUri,
    authUrl,
  });
}
