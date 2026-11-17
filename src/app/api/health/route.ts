import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageConfig } from "@/lib/storage";
import { isEmailProviderConfigured } from "@/lib/notifications";
import { getRazorpayConfig } from "@/lib/billing/razorpay";
import { isErrorMonitoringConfigured } from "@/lib/monitoring";
import { getAllProviderStatuses } from "@/lib/social-providers/oauth-service";

/**
 * GET /api/health
 * Production health & readiness probe for uptime monitoring (Netlify / UptimeRobot / BetterStack).
 * Never exposes secret values — reports connectivity and configuration booleans only.
 */
export async function GET() {
  const startedAt = Date.now();
  let dbHealthy = false;
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const providerStatuses = getAllProviderStatuses();
  const liveSocialProviders = Object.entries(providerStatuses)
    .filter(([, s]) => s.mode === "live")
    .map(([key]) => key);

  const storageConfig = getStorageConfig();
  const razorpayConfig = getRazorpayConfig();
  const status = dbHealthy ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      checks: {
        database: {
          status: dbHealthy ? "up" : "down",
          latencyMs: dbLatencyMs,
        },
        storage: {
          configured: storageConfig.isSupabaseConfigured,
          provider: storageConfig.isSupabaseConfigured ? "supabase" : "unconfigured",
        },
        billing: {
          razorpayConfigured: razorpayConfig.isConfigured,
          testMode: razorpayConfig.isTestMode,
        },
        email: {
          resendConfigured: isEmailProviderConfigured(),
        },
        monitoring: {
          externalAlertingConfigured: isErrorMonitoringConfigured(),
        },
        socialProviders: {
          liveCount: liveSocialProviders.length,
          liveProviders: liveSocialProviders,
          mockModeEnabled: process.env.MOCK_SOCIAL_PROVIDERS !== "false",
        },
      },
    },
    {
      status: dbHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
