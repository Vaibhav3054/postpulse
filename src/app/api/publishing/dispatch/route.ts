import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { dispatchDueScheduledPosts } from "@/lib/queue/publishing-queue";
import { requireApiSession } from "@/lib/authorization";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

function isValidCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || cronSecret.length < 16) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const candidate = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : headerSecret?.trim();

  if (!candidate) return false;

  const expectedBuf = Buffer.from(cronSecret);
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}

/**
 * GET /api/publishing/dispatch — Strictly reserved for authenticated Cron triggers using CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isValidCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchDueScheduledPosts();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Dispatch failed" }, { status: 500 });
  }
}

/**
 * POST /api/publishing/dispatch — Authorized via CRON_SECRET OR an active authenticated user session (rate-limited).
 */
export async function POST(req: NextRequest) {
  const isCron = isValidCronRequest(req);

  if (!isCron) {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;

    const clientIp = getClientIp(req);
    const rateResult = await checkRateLimit(
      `publishing:dispatch:${auth.user.id}:${clientIp}`,
      12,
      60 * 1000
    );
    if (!rateResult.allowed) {
      return rateLimitExceededResponse(rateResult, "Too many manual sync requests. Please wait a moment.");
    }
  }

  try {
    const result = await dispatchDueScheduledPosts();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Dispatch failed" }, { status: 500 });
  }
}
