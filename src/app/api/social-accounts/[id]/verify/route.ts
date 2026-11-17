import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { getProviderIntegrationStatus } from "@/lib/social-providers/oauth-service";
import { SocialPlatformType } from "@/lib/social-providers/types";

/**
 * POST /api/social-accounts/[id]/verify
 *
 * Verifies OAuth connection health & granted permissions for a connected social account.
 * Transparently distinguishes sandbox/mock accounts from live official API tokens.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const account = await prisma.socialAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Social account not found." }, { status: 404 });
  }

  const memberCheck = await requireWorkspaceMember(account.workspaceId, auth.user.id, [
    "OWNER",
    "ADMIN",
  ]);
  if (memberCheck.error) return memberCheck.error;

  const meta = (account.metadata as Record<string, unknown>) || {};
  const providerStatus = getProviderIntegrationStatus(account.platform as SocialPlatformType);
  const accessToken = decryptToken(account.accessTokenEncrypted);
  const isMockAccount =
    meta.isMock === true ||
    providerStatus.mode === "mock_sandbox" ||
    accessToken.startsWith("mock_") ||
    accessToken.startsWith("gbp_access_token_") ||
    accessToken.startsWith("fb_page_token_") ||
    accessToken.startsWith("ig_live_token_") ||
    accessToken.startsWith("li_token_");

  if (isMockAccount) {
    const updatedMeta = {
      ...meta,
      isMock: true,
      connectionMode: "mock_sandbox",
      lastVerifiedAt: new Date().toISOString(),
    };
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { metadata: updatedMeta as object },
    });

    return NextResponse.json({
      valid: true,
      mode: "mock_sandbox",
      needsReauth: false,
      scopes: account.scopes,
      tokenExpiresAt: account.tokenExpiresAt,
      message:
        "Sandbox mock account active. Not connected to live third-party APIs until provider credentials are configured.",
    });
  }

  try {
    const provider = getSocialProvider(account.platform as SocialPlatformType);
    let currentToken = accessToken;
    let currentExpiresAt = account.tokenExpiresAt;
    let refreshed = false;

    const isExpiringSoon =
      currentExpiresAt !== null &&
      currentExpiresAt.getTime() <= Date.now() + 10 * 60 * 1000;

    if (isExpiringSoon && account.refreshTokenEncrypted) {
      const refreshRaw = decryptToken(account.refreshTokenEncrypted);
      const refreshedRes = await provider.refreshToken(refreshRaw);
      currentToken = refreshedRes.accessToken;
      currentExpiresAt = refreshedRes.expiresAt || new Date(Date.now() + 3600 * 1000);
      refreshed = true;
    }

    const isValid = await provider.validateConnection(currentToken);

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        ...(refreshed
          ? {
              accessTokenEncrypted: encryptToken(currentToken),
              tokenExpiresAt: currentExpiresAt,
            }
          : {}),
        metadata: {
          ...meta,
          isMock: false,
          connectionMode: "live",
          needsReauth: !isValid,
          lastVerifiedAt: new Date().toISOString(),
        } as object,
      },
    });

    return NextResponse.json({
      valid: isValid,
      mode: "live",
      refreshed,
      needsReauth: !isValid,
      scopes: account.scopes,
      tokenExpiresAt: currentExpiresAt,
      message: isValid
        ? "Live OAuth connection verified with official provider API."
        : "OAuth token is expired or revoked. Please reauthorize this account.",
    });
  } catch (err: unknown) {
    const error = err as Error;
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        metadata: {
          ...meta,
          needsReauth: true,
          reauthReason: error.message,
          lastVerifiedAt: new Date().toISOString(),
        } as object,
      },
    });

    return NextResponse.json({
      valid: false,
      mode: "live",
      needsReauth: true,
      scopes: account.scopes,
      tokenExpiresAt: account.tokenExpiresAt,
      message: `Connection verification failed: ${error.message}`,
    });
  }
}
