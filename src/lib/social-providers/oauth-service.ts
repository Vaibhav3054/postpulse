import crypto from "crypto";
import { SocialPlatform } from "@prisma/client";
import { prisma } from "../prisma";
import { SocialPlatformType } from "./types";

export type ProviderRuntimeMode = "live" | "mock_sandbox";

export interface ProviderIntegrationStatus {
  platform: SocialPlatformType;
  mode: ProviderRuntimeMode;
  isConfigured: boolean;
  missingEnvVars: string[];
  callbackPath: string;
}

const PLACEHOLDER_PREFIXES = [
  "your_",
  "mock_",
  "replace_with_",
  "placeholder",
  "changeme",
];

function isRealEnvValue(val?: string): boolean {
  const trimmed = (val || "").trim();
  if (!trimmed || trimmed.length < 6) return false;
  const lower = trimmed.toLowerCase();
  return !PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

const PLATFORM_ENV_REQUIREMENTS: Record<
  SocialPlatformType,
  { envVars: string[]; callbackPath: string; redirectEnvVar: string }
> = {
  GOOGLE_BUSINESS: {
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/google",
    redirectEnvVar: "GOOGLE_OAUTH_REDIRECT_URI",
  },
  YOUTUBE: {
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/google",
    redirectEnvVar: "GOOGLE_OAUTH_REDIRECT_URI",
  },
  FACEBOOK: {
    envVars: ["META_APP_ID", "META_APP_SECRET"],
    callbackPath: "/api/auth/callback/meta",
    redirectEnvVar: "META_OAUTH_REDIRECT_URI",
  },
  INSTAGRAM: {
    envVars: ["META_APP_ID", "META_APP_SECRET"],
    callbackPath: "/api/auth/callback/meta",
    redirectEnvVar: "META_OAUTH_REDIRECT_URI",
  },
  LINKEDIN: {
    envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    callbackPath: "/api/auth/callback/linkedin",
    redirectEnvVar: "LINKEDIN_OAUTH_REDIRECT_URI",
  },
};

export function getProviderIntegrationStatus(
  platform: SocialPlatformType
): ProviderIntegrationStatus {
  const req = PLATFORM_ENV_REQUIREMENTS[platform];
  const missingEnvVars = req.envVars.filter((name) => !isRealEnvValue(process.env[name]));
  const forceMock = process.env.MOCK_SOCIAL_PROVIDERS === "true";
  const isConfigured = missingEnvVars.length === 0;
  const mode: ProviderRuntimeMode = !forceMock && isConfigured ? "live" : "mock_sandbox";

  return {
    platform,
    mode,
    isConfigured,
    missingEnvVars,
    callbackPath: req.callbackPath,
  };
}

export function getAllProviderStatuses(): Record<SocialPlatformType, ProviderIntegrationStatus> {
  return {
    GOOGLE_BUSINESS: getProviderIntegrationStatus("GOOGLE_BUSINESS"),
    FACEBOOK: getProviderIntegrationStatus("FACEBOOK"),
    INSTAGRAM: getProviderIntegrationStatus("INSTAGRAM"),
    LINKEDIN: getProviderIntegrationStatus("LINKEDIN"),
    YOUTUBE: getProviderIntegrationStatus("YOUTUBE"),
  };
}

export function getCallbackUriForPlatform(
  platform: SocialPlatformType,
  requestOrigin?: string
): string {
  const req = PLATFORM_ENV_REQUIREMENTS[platform];
  const explicit = process.env[req.redirectEnvVar]?.trim();
  if (explicit && isRealEnvValue(explicit)) {
    return explicit;
  }
  const baseUrl = (
    process.env.APP_URL ||
    process.env.URL ||
    requestOrigin ||
    "http://localhost:3000"
  )
    .trim()
    .replace(/\/$/, "");
  return `${baseUrl}${req.callbackPath}`;
}

/**
 * Generates and stores a one-time, 10-minute server-side CSRF OAuth state token.
 */
export async function createOAuthState(params: {
  workspaceId: string;
  userId: string;
  platform: SocialPlatformType;
  redirectUri: string;
}): Promise<string> {
  const now = new Date();
  // Opportunistic cleanup of expired states
  if (Math.random() < 0.1) {
    prisma.oAuthState
      .deleteMany({ where: { expiresAt: { lt: now } } })
      .catch(() => {});
  }

  const stateToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  await prisma.oAuthState.create({
    data: {
      stateToken,
      workspaceId: params.workspaceId,
      userId: params.userId,
      platform: params.platform as SocialPlatform,
      redirectUri: params.redirectUri,
      expiresAt,
    },
  });

  return stateToken;
}

/**
 * Atomically validates and consumes a one-time OAuth CSRF state token.
 * Rejects unknown, expired, or already-used tokens (replay attack protection).
 */
export async function consumeOAuthState(stateToken: string) {
  if (!stateToken || stateToken.length < 16) {
    return null;
  }

  const now = new Date();
  const claimed = await prisma.oAuthState.updateMany({
    where: {
      stateToken,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      usedAt: now,
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  return prisma.oAuthState.findUnique({
    where: { stateToken },
  });
}
