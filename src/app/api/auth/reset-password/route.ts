import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Invalid reset token.").max(128),
  password: z
    .string()
    .min(8, "New password must be at least 8 characters long.")
    .max(128, "Password must be 128 characters or fewer."),
});

function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * GET /api/auth/reset-password?token=...
 * Checks whether a reset token is valid and unused without revealing user PII.
 */
export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  if (!token || token.length < 32) {
    return NextResponse.json({ valid: false, reason: "INVALID" }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, usedAt: true, user: { select: { status: true } } },
  });

  if (!record || record.user.status !== "ACTIVE") {
    return NextResponse.json({ valid: false, reason: "INVALID" }, { status: 404 });
  }
  if (record.usedAt) {
    return NextResponse.json({ valid: false, reason: "USED" }, { status: 410 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({ valid: true, expiresAt: record.expiresAt.toISOString() });
}

/**
 * POST /api/auth/reset-password
 * Atomically verifies the one-time token, updates passwordHash, marks the token used,
 * and increments User.tokenVersion so all previously issued JWT sessions are immediately revoked.
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rate = await checkRateLimit(`auth:reset:ip:${clientIp}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return rateLimitExceededResponse(
      rate,
      "Too many password reset attempts. Please try again later."
    );
  }

  const parsed = await parseJsonBody(req, resetPasswordSchema);
  if (parsed.error) return parsed.error;

  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, status: true } },
      },
    });

    if (!record || record.user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    if (record.usedAt) {
      return NextResponse.json(
        { error: "This password reset link has already been used. Please request a new one." },
        { status: 410 }
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This password reset link has expired. Please request a new one." },
        { status: 410 }
      );
    }

    const newPasswordHash = await hashPassword(password);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      // Atomic conditional consume prevents concurrent replay of the same token
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count === 0) {
        return false;
      }

      // Expire any other outstanding tokens for this user
      await tx.passwordResetToken.updateMany({
        where: { userId: record.user.id, usedAt: null },
        data: { usedAt: now },
      });

      // Update password AND increment tokenVersion to revoke all active JWT sessions everywhere
      await tx.user.update({
        where: { id: record.user.id },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      });

      return true;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "This password reset link is no longer valid. Please request a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully. All previous sessions have been signed out.",
    });
  } catch (err) {
    await captureException(err, { route: "POST /api/auth/reset-password" });
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
