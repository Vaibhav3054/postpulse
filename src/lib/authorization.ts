import { NextRequest, NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { SocialPlatform, WorkspaceRole } from "@prisma/client";
import { getSessionFromRequest, getSessionUser, SessionUser } from "./auth";
import { prisma } from "./prisma";
import { db } from "./db";

export interface AuthenticatedApiUser extends SessionUser {
  status: "ACTIVE" | "SUSPENDED";
  tokenVersion: number;
}

/**
 * Verifies the API request JWT and confirms the user exists, is ACTIVE, and tokenVersion matches.
 */
export async function requireApiSession(
  req: NextRequest
): Promise<
  | { user: AuthenticatedApiUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  const session = getSessionFromRequest(req);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      systemRole: true,
      status: true,
      tokenVersion: true,
    },
  });

  if (!dbUser) {
    return {
      error: NextResponse.json({ error: "Unauthorized: Account not found." }, { status: 401 }),
    };
  }

  if (dbUser.status === "SUSPENDED") {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Your account has been suspended. Please contact support." },
        { status: 403 }
      ),
    };
  }

  if (
    typeof session.tokenVersion === "number" &&
    session.tokenVersion !== dbUser.tokenVersion
  ) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized: Session has been revoked. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      systemRole: dbUser.systemRole,
      status: dbUser.status,
      tokenVersion: dbUser.tokenVersion,
    },
  };
}

/**
 * Verifies that userId is a member of workspaceId with one of allowedRoles (if specified).
 */
export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
  allowedRoles?: WorkspaceRole[]
): Promise<
  | { membership: { id: string; workspaceId: string; userId: string; role: WorkspaceRole }; error?: never }
  | { membership?: never; error: NextResponse }
> {
  const membership = await db.workspaces.checkMembership(workspaceId, userId);
  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Not a member of this workspace." },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return {
      error: NextResponse.json(
        {
          error: `Forbidden: Requires ${allowedRoles.join(" or ")} role in this workspace.`,
        },
        { status: 403 }
      ),
    };
  }

  return { membership };
}

/**
 * Verifies that socialAccountId exists AND strictly belongs to workspaceId (and optionally matches platform).
 * Eliminates Cross-Tenant IDOR on account-management and publishing routes.
 */
export async function requireWorkspaceSocialAccount(
  workspaceId: string,
  socialAccountId: string,
  expectedPlatform?: SocialPlatform
) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
  });

  if (!account) {
    return {
      error: NextResponse.json({ error: "Social account not found." }, { status: 404 }),
    };
  }

  if (account.workspaceId !== workspaceId) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Social account does not belong to this workspace." },
        { status: 403 }
      ),
    };
  }

  if (expectedPlatform && account.platform !== expectedPlatform) {
    return {
      error: NextResponse.json(
        { error: `Social account is not a ${expectedPlatform} account.` },
        { status: 400 }
      ),
    };
  }

  return { account };
}

/**
 * Verifies that every socialAccountId in a list belongs strictly to workspaceId.
 */
export async function verifyWorkspaceSocialAccounts(
  workspaceId: string,
  socialAccountIds: string[]
): Promise<{ ok: true; error?: never } | { ok: false; error: NextResponse }> {
  const uniqueIds = Array.from(new Set(socialAccountIds));
  if (uniqueIds.length === 0) return { ok: true };

  const count = await prisma.socialAccount.count({
    where: {
      id: { in: uniqueIds },
      workspaceId,
    },
  });

  if (count !== uniqueIds.length) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Forbidden: One or more social accounts do not belong to this workspace." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/**
 * Verifies that every mediaAssetId in a list belongs strictly to workspaceId.
 */
export async function verifyWorkspaceMediaAssets(
  workspaceId: string,
  mediaAssetIds: string[]
): Promise<{ ok: true; error?: never } | { ok: false; error: NextResponse }> {
  const uniqueIds = Array.from(new Set(mediaAssetIds));
  if (uniqueIds.length === 0) return { ok: true };

  const count = await prisma.mediaAsset.count({
    where: {
      id: { in: uniqueIds },
      workspaceId,
    },
  });

  if (count !== uniqueIds.length) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Forbidden: One or more media assets do not belong to this workspace." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/**
 * Strips encrypted OAuth token fields before returning a SocialAccount to any client.
 */
export function sanitizeSocialAccount<
  T extends { accessTokenEncrypted?: unknown; refreshTokenEncrypted?: unknown }
>(account: T): Omit<T, "accessTokenEncrypted" | "refreshTokenEncrypted"> {
  const { accessTokenEncrypted: _a, refreshTokenEncrypted: _r, ...safe } = account;
  return safe;
}

/**
 * Defense-in-depth Server Component guard for every page under /app/[workspaceSlug]/*.
 * Ensures authentication, active user status, workspace existence, and membership.
 */
export async function requireServerWorkspaceAccess(workspaceSlug: string) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      systemRole: true,
      status: true,
      tokenVersion: true,
    },
  });

  if (!dbUser || dbUser.status === "SUSPENDED") {
    redirect("/login");
  }

  if (
    typeof session.tokenVersion === "number" &&
    session.tokenVersion !== dbUser.tokenVersion
  ) {
    redirect("/login");
  }

  const workspace = await db.workspaces.findBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  const membership = await db.workspaces.checkMembership(workspace.id, dbUser.id);
  if (!membership) {
    redirect("/app");
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      systemRole: dbUser.systemRole,
      tokenVersion: dbUser.tokenVersion,
    },
    workspace,
    membership,
  };
}
