import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function getMaxSizeForMime(mimeType: string): number {
  return mimeType.toLowerCase().startsWith("video/")
    ? MAX_VIDEO_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
}

/**
 * Verifies binary file magic bytes match the declared MIME type to block spoofed uploads
 * (e.g. HTML/JS/EXE disguised with Content-Type: image/jpeg).
 */
export function hasValidMediaMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  const mime = mimeType.toLowerCase();

  // JPEG: FF D8 FF
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  // GIF: GIF87a or GIF89a
  if (mime === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  // WebP: RIFF....WEBP
  if (mime === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  // MP4 / MOV (ISO Base Media File Format): bytes 4..8 === "ftyp"
  if (mime === "video/mp4" || mime === "video/quicktime") {
    return (
      buffer.length >= 12 &&
      (buffer.subarray(4, 8).toString("ascii") === "ftyp" ||
        buffer.subarray(4, 8).toString("ascii") === "moov" ||
        buffer.subarray(4, 8).toString("ascii") === "wide")
    );
  }
  // WebM / EBML: 1A 45 DF A3
  if (mime === "video/webm") {
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }

  return false;
}

/**
 * Validates storageKey format strictly: workspaces/{workspaceId}/{filename}
 * Blocks path traversal (..), backslashes, leading slashes, and control characters.
 */
export const STORAGE_KEY_REGEX = /^workspaces\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9._-]+)$/;

export function parseAndValidateStorageKey(storageKey: string): {
  valid: boolean;
  workspaceId?: string;
  fileName?: string;
} {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/")
  ) {
    return { valid: false };
  }
  const match = STORAGE_KEY_REGEX.exec(storageKey);
  if (!match) return { valid: false };
  return {
    valid: true,
    workspaceId: match[1],
    fileName: match[2],
  };
}

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter (A-Z).")
  .regex(/[a-z]/, "Password must include at least one lowercase letter (a-z).")
  .regex(/[0-9]/, "Password must include at least one number (0-9).")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special symbol (e.g. !@#$%).");

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  password: z.string().min(1, "Password is required.").max(200),
});

export const signupSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  password: strongPasswordSchema,
  fullName: z.string().trim().min(1).max(120).optional(),
  workspaceName: z.string().trim().min(1).max(120).optional(),
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(100),
  slug: z.string().trim().max(100).optional(),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(100),
});

const socialPlatformEnum = z.enum([
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "LINKEDIN",
  "GOOGLE_BUSINESS",
]);

export const postCreateSchema = z.object({
  workspaceId: z.string().trim().min(1, "workspaceId is required."),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]).default("DRAFT"),
  commonCaption: z.string().max(10000).optional().default(""),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  timezone: z.string().trim().max(80).optional().default("UTC"),
  mediaAssetIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  targets: z
    .array(
      z.object({
        socialAccountId: z.string().trim().min(1),
        platform: socialPlatformEnum,
        customCaption: z.string().max(10000).optional(),
        platformPayload: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1, "At least one social account target is required.")
    .max(20),
});

export const postUpdateSchema = z.object({
  commonCaption: z.string().max(10000).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  timezone: z.string().trim().max(80).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHING", "PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"]).optional(),
  mediaAssetIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export const mediaUploadUrlSchema = z.object({
  workspaceId: z.string().trim().min(1, "workspaceId is required."),
  fileName: z.string().trim().min(1, "fileName is required.").max(255),
  mimeType: z.string().trim().min(1, "mimeType is required.").max(120),
  fileSizeBytes: z.number().int().nonnegative().optional(),
});

export const mediaCreateSchema = z.object({
  workspaceId: z.string().trim().min(1, "workspaceId is required."),
  fileName: z.string().trim().min(1, "fileName is required.").max(255),
  storageKey: z.string().trim().min(1, "storageKey is required.").max(500),
  publicUrl: z.string().trim().min(1, "publicUrl is required.").max(1000),
  mediaType: z.enum(["IMAGE", "VIDEO"]).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
});

export const socialAccountConnectSchema = z.object({
  workspaceId: z.string().trim().min(1, "workspaceId is required."),
  platform: socialPlatformEnum,
  mockCode: z.string().trim().max(200).optional(),
});

export const gbpPatchSchema = z.object({
  workspaceId: z.string().trim().min(1),
  socialAccountId: z.string().trim().min(1),
  action: z.enum(["update_info", "update_hours"]),
  data: z.record(z.string(), z.unknown()),
});

export const gbpReviewReplySchema = z.object({
  workspaceId: z.string().trim().min(1),
  socialAccountId: z.string().trim().min(1),
  reviewId: z.string().trim().min(1),
  replyText: z.string().trim().min(1, "Reply text cannot be empty.").max(4000),
});

export const gbpPhotoAddSchema = z.object({
  workspaceId: z.string().trim().min(1),
  socialAccountId: z.string().trim().min(1),
  photo: z.object({
    url: z.string().trim().url("Photo URL must be a valid URL."),
    category: z.string().trim().max(60).optional(),
    caption: z.string().trim().max(500).optional(),
  }),
});

export const facebookPatchSchema = z.object({
  workspaceId: z.string().trim().min(1),
  socialAccountId: z.string().trim().min(1),
  about: z.string().max(2000).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(300).optional(),
  hours: z.unknown().optional(),
});

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      error: NextResponse.json(
        {
          error: firstIssue?.message || "Validation failed.",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { data: parsed.data };
}
