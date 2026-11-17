import crypto from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getClientIp } from "./rate-limit";

const ADMIN_COOKIE_NAME = "postpulse_admin_session";
const ADMIN_AUDIENCE = "postpulse_platform_admin";

function getAdminJwtSecret(): string {
  const dedicated = process.env.ADMIN_JWT_SECRET?.trim();
  if (dedicated && dedicated.length >= 32 && !dedicated.startsWith("replace_with_")) {
    return dedicated;
  }
  const base = process.env.JWT_SECRET?.trim();
  if (!base || base.length < 32 || base.startsWith("replace_with_")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL SECURITY CONFIGURATION ERROR: ADMIN_JWT_SECRET or JWT_SECRET (32+ chars) must be set in production."
      );
    }
    return crypto
      .createHash("sha256")
      .update("dev_only_local_admin_secret_do_not_use_in_prod")
      .digest("hex");
  }
  // Domain-separate admin signing key from customer signing key so customer tokens can never be accepted
  return crypto
    .createHash("sha256")
    .update(`postpulse_super_admin_domain_v1:${base}`)
    .digest("hex");
}

export interface AdminSessionUser {
  id: string;
  email: string;
  fullName?: string | null;
  systemRole: "SUPERADMIN";
  tokenVersion: number;
}

export function isEmailAllowedForSuperAdmin(email: string): boolean {
  const allowlistRaw = process.env.SUPERADMIN_EMAILS?.trim();
  if (!allowlistRaw) return true; // Optional extra layer when configured
  const allowed = allowlistRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}

export function signAdminSessionToken(admin: AdminSessionUser): string {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      systemRole: "SUPERADMIN",
      tokenVersion: admin.tokenVersion,
      aud: ADMIN_AUDIENCE,
    },
    getAdminJwtSecret(),
    { expiresIn: "12h" }
  );
}

export function verifyAdminSessionToken(token: string): AdminSessionUser | null {
  try {
    const payload = jwt.verify(token, getAdminJwtSecret(), {
      audience: ADMIN_AUDIENCE,
    }) as AdminSessionUser & { aud?: string };
    if (!payload?.id || payload.systemRole !== "SUPERADMIN") return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminCookieOptions() {
  return {
    name: ADMIN_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  };
}

async function validateAdminInDatabase(payload: AdminSessionUser | null) {
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      systemRole: true,
      status: true,
      tokenVersion: true,
    },
  });

  if (
    !dbUser ||
    dbUser.systemRole !== "SUPERADMIN" ||
    dbUser.status !== "ACTIVE" ||
    dbUser.tokenVersion !== payload.tokenVersion ||
    !isEmailAllowedForSuperAdmin(dbUser.email)
  ) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    systemRole: "SUPERADMIN" as const,
    tokenVersion: dbUser.tokenVersion,
  };
}

export async function getAdminServerSession(): Promise<AdminSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = verifyAdminSessionToken(token);
    return validateAdminInDatabase(payload);
  } catch {
    return null;
  }
}

export async function requireAdminServerSession(): Promise<AdminSessionUser> {
  const admin = await getAdminServerSession();
  if (!admin) {
    redirect("/platform-admin/login");
  }
  return admin;
}

export async function requireAdminApiSession(
  req: NextRequest
): Promise<{ admin: AdminSessionUser; error?: never } | { admin?: never; error: NextResponse }> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized: Super Admin session required." }, { status: 401 }),
    };
  }

  const payload = verifyAdminSessionToken(token);
  const admin = await validateAdminInDatabase(payload);
  if (!admin) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Valid Super Admin privileges required." },
        { status: 403 }
      ),
    };
  }

  return { admin };
}

export async function recordAdminAuditLog(params: {
  admin: AdminSessionUser;
  targetUserId?: string | null;
  targetEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  req?: NextRequest;
}) {
  return prisma.adminAuditLog.create({
    data: {
      adminUserId: params.admin.id,
      adminEmail: params.admin.email,
      targetUserId: params.targetUserId || null,
      targetEmail: params.targetEmail || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      previousValue:
        params.previousValue !== undefined ? (params.previousValue as object) : undefined,
      newValue: params.newValue !== undefined ? (params.newValue as object) : undefined,
      reason: params.reason || null,
      ipAddress: params.req ? getClientIp(params.req) : null,
    },
  });
}
