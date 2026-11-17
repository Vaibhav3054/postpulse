import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
}

// Graceful in-memory fallback if PostgreSQL rate-limit table is temporarily unreachable
const memoryFallback = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: NextRequest): string {
  const nfIp = req.headers.get("x-nf-client-connection-ip");
  if (nfIp) return nfIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function checkMemoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryFallback.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryFallback.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(resetAt),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: new Date(existing.resetAt),
    retryAfterSec,
  };
}

/**
 * Hybrid PostgreSQL + In-Memory sliding window rate limiter.
 * Persists across Netlify serverless cold starts at zero extra infrastructure cost.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  try {
    // Opportunistic cleanup of expired buckets (~2% of requests)
    if (Math.random() < 0.02) {
      prisma.rateLimitBucket
        .deleteMany({ where: { resetAt: { lt: now } } })
        .catch(() => {});
    }

    const bucket = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

      if (!existing || existing.resetAt <= now) {
        return tx.rateLimitBucket.upsert({
          where: { key },
          update: { count: 1, resetAt: nextResetAt },
          create: { key, count: 1, resetAt: nextResetAt },
        });
      }

      return tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    });

    const allowed = bucket.count <= limit;
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));

    return {
      allowed,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSec,
    };
  } catch {
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

export function rateLimitExceededResponse(result: RateLimitResult, message?: string) {
  return NextResponse.json(
    {
      error: message || "Too many requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
      },
    }
  );
}
