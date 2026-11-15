import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSocialProvider } from "@/lib/social-providers/registry";
import { SocialPlatformType } from "@/lib/social-providers/types";
import { encryptToken } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as SocialPlatformType;
  const state = searchParams.get("state"); // workspaceSlug or workspaceId

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!platform || !state) {
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
      metadata: result.account.metadata || {},
      isActive: true,
    });

    await db.activity.log({
      workspaceId: workspace.id,
      userId: session.id,
      action: "SOCIAL_ACCOUNT_CONNECTED",
      entityType: "SOCIAL_ACCOUNT",
      metadata: { platform, username: result.account.platformUsername },
    });

    return NextResponse.redirect(
      new URL(`/app/${workspace.slug}/social-accounts?connected=${platform}`, req.url)
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.redirect(
      new URL(`/app/${workspace.slug}/social-accounts?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
