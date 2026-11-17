import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "postpulse_session";
const INSECURE_PLACEHOLDERS = new Set([
  "default_dev_secret_must_be_changed_in_prod",
  "replace_with_a_long_random_jwt_secret_key_minimum_32_characters",
  "changeme",
  "secret",
]);

let devFallbackWarned = false;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (!secret || INSECURE_PLACEHOLDERS.has(secret) || secret.length < 32) {
    if (isProd) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION ERROR: JWT_SECRET must be set to a cryptographically strong string (minimum 32 characters) in production."
      );
    }
    if (!devFallbackWarned) {
      devFallbackWarned = true;
      console.warn(
        "[Security Warning] JWT_SECRET is unset or weak in development. Configure a 32+ char JWT_SECRET in .env."
      );
    }
    return secret && secret.length >= 16 ? secret : "dev_only_local_jwt_secret_do_not_use_in_prod_32ch";
  }

  return secret;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName?: string | null;
  systemRole: "USER" | "SUPERADMIN";
  tokenVersion?: number;
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  if (!plainText || !hashed) return false;
  return bcrypt.compare(plainText, hashed);
}

export function signSessionToken(user: SessionUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      systemRole: user.systemRole,
      tokenVersion: user.tokenVersion ?? 0,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as SessionUser;
    if (!payload?.id || !payload?.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the current session user from incoming server cookies.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Extracts session from NextRequest headers/cookies for Route Handlers.
 */
export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return verifySessionToken(authHeader.substring(7));
    }
    return null;
  }
  return verifySessionToken(token);
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
