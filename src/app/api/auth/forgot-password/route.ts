import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/notifications";
import { captureException } from "@/lib/monitoring";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(255),
});

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const GENERIC_SUCCESS_RESPONSE = {
  ok: true,
  message:
    "If an account exists for that email address, we have sent a password reset link that expires in 30 minutes.",
};

function getBaseUrl(req: NextRequest): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return req.nextUrl.origin;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/auth/forgot-password
 * Enumeration-safe password reset request:
 * - Always returns HTTP 200 with identical message regardless of whether email exists.
 * - Stores only a SHA-256 hash of the 32-byte random reset token (30-min expiry).
 * - Invalidates any prior unused reset tokens for the account.
 * - Sends email via Resend when configured (never returns the raw token over HTTP).
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const ipRate = await checkRateLimit(`auth:forgot:ip:${clientIp}`, 10, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    return rateLimitExceededResponse(
      ipRate,
      "Too many password reset requests. Please try again in 15 minutes."
    );
  }

  const parsed = await parseJsonBody(req, forgotPasswordSchema);
  if (parsed.error) return parsed.error;

  const email = parsed.data.email.toLowerCase();

  const emailRate = await checkRateLimit(`auth:forgot:email:${email}`, 5, 15 * 60 * 1000);
  if (!emailRate.allowed) {
    return rateLimitExceededResponse(
      emailRate,
      "Too many reset attempts for this email. Please wait before trying again."
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, status: true },
    });

    // Enumeration-safe: return identical 200 even if user doesn't exist or is disabled
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.$transaction([
      // Invalidate any prior unused reset tokens for this user
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedIp: clientIp,
        },
      }),
    ]);

    const resetUrl = `${getBaseUrl(req)}/reset-password/${rawToken}`;
    const safeName = escapeHtml(user.fullName || "there");

    await sendTransactionalEmail({
      to: user.email,
      subject: "Reset your PostPulse password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <div style="margin-bottom: 20px;">
            <span style="display:inline-block; background:#4f46e5; color:#fff; font-weight:700; width:32px; height:32px; line-height:32px; text-align:center; border-radius:8px; margin-right:8px;">P</span>
            <strong style="font-size:18px; vertical-align:middle;">PostPulse</strong>
          </div>
          <h2 style="margin: 0 0 12px; font-size: 20px;">Password Reset Request</h2>
          <p style="margin: 0 0 16px; color: #3f3f46; line-height: 1.6;">
            Hi ${safeName}, we received a request to reset the password for your PostPulse account.
            Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.
          </p>
          <p style="margin: 24px 0;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:10px;">
              Reset Password
            </a>
          </p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #71717a; line-height: 1.5;">
            If you did not request a password reset, you can safely ignore this email. Your existing password will remain unchanged.
          </p>
        </div>
      `,
      text: `Hi ${user.fullName || "there"},\n\nReset your PostPulse password using this link (expires in 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    });

    return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
  } catch (err) {
    await captureException(err, { route: "POST /api/auth/forgot-password" });
    return NextResponse.json(
      { error: "Unable to process password reset request right now. Please try again." },
      { status: 500 }
    );
  }
}
