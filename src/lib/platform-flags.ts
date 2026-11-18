import { prisma } from "./prisma";
import { SocialPlatformType } from "./social-providers/types";

export const SOCIAL_PLATFORM_FLAGS_KEY = "social_platform_flags";

export const ALL_SOCIAL_PLATFORMS: SocialPlatformType[] = [
  "GOOGLE_BUSINESS",
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "YOUTUBE",
];

export interface SocialPlatformFlags {
  platforms: Record<SocialPlatformType, boolean>;
  allowSuperAdminBypass: boolean;
}

export interface PlatformAvailability {
  enabledForPublic: boolean;
  canConnect: boolean;
  isComingSoon: boolean;
  adminPreviewBypass: boolean;
}

export const DEFAULT_SOCIAL_PLATFORM_FLAGS: SocialPlatformFlags = {
  platforms: {
    GOOGLE_BUSINESS: true,
    FACEBOOK: true,
    INSTAGRAM: true,
    LINKEDIN: true,
    YOUTUBE: true,
  },
  allowSuperAdminBypass: true,
};

export function normalizeSocialPlatformFlags(raw: unknown): SocialPlatformFlags {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawPlatforms =
    obj.platforms && typeof obj.platforms === "object"
      ? (obj.platforms as Record<string, unknown>)
      : {};

  const platforms = { ...DEFAULT_SOCIAL_PLATFORM_FLAGS.platforms };
  for (const key of ALL_SOCIAL_PLATFORMS) {
    if (typeof rawPlatforms[key] === "boolean") {
      platforms[key] = rawPlatforms[key] as boolean;
    }
  }

  const allowSuperAdminBypass =
    typeof obj.allowSuperAdminBypass === "boolean"
      ? obj.allowSuperAdminBypass
      : DEFAULT_SOCIAL_PLATFORM_FLAGS.allowSuperAdminBypass;

  return { platforms, allowSuperAdminBypass };
}

/**
 * Fetches live social platform availability flags from PlatformSetting.
 * Always reads fresh from DB (fast primary-key lookup) so toggles in /platform-admin
 * take effect immediately across all Netlify serverless invocations without redeploying.
 */
export async function getSocialPlatformFlags(): Promise<SocialPlatformFlags> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: SOCIAL_PLATFORM_FLAGS_KEY },
      select: { value: true },
    });
    if (!row) return { ...DEFAULT_SOCIAL_PLATFORM_FLAGS, platforms: { ...DEFAULT_SOCIAL_PLATFORM_FLAGS.platforms } };
    return normalizeSocialPlatformFlags(row.value);
  } catch (err) {
    console.error("[PlatformFlags] Failed to read social_platform_flags, falling back to defaults:", err);
    return { ...DEFAULT_SOCIAL_PLATFORM_FLAGS, platforms: { ...DEFAULT_SOCIAL_PLATFORM_FLAGS.platforms } };
  }
}

export function resolvePlatformAvailability(
  flags: SocialPlatformFlags,
  userSystemRole?: string | null
): Record<SocialPlatformType, PlatformAvailability> {
  const isSuperAdmin = userSystemRole === "SUPERADMIN";
  const result = {} as Record<SocialPlatformType, PlatformAvailability>;

  for (const platform of ALL_SOCIAL_PLATFORMS) {
    const enabledForPublic = flags.platforms[platform] !== false;
    const adminPreviewBypass = !enabledForPublic && isSuperAdmin && flags.allowSuperAdminBypass;
    const canConnect = enabledForPublic || adminPreviewBypass;

    result[platform] = {
      enabledForPublic,
      canConnect,
      isComingSoon: !enabledForPublic,
      adminPreviewBypass,
    };
  }

  return result;
}
