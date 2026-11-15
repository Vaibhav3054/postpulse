import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "postpulse-assets";
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN;

const isR2Configured = Boolean(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_ACCESS_KEY_ID !== "local_dev_key"
);

export const s3Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  isDirectUpload: boolean;
}

/**
 * Generates a presigned PUT URL for Cloudflare R2, or a local endpoint URL for dev fallback.
 */
export async function generateUploadUrl(
  workspaceId: string,
  fileName: string,
  mimeType: string
): Promise<PresignedUploadResponse> {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const storageKey = `workspaces/${workspaceId}/${uniqueId}-${sanitizedFileName}`;

  if (s3Client && isR2Configured) {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = R2_PUBLIC_DOMAIN
      ? `${R2_PUBLIC_DOMAIN}/${storageKey}`
      : `https://${R2_BUCKET_NAME}.r2.cloudflarestorage.com/${storageKey}`;

    return {
      uploadUrl,
      storageKey,
      publicUrl,
      isDirectUpload: true,
    };
  }

  // Local development fallback
  return {
    uploadUrl: `/api/media/upload?key=${encodeURIComponent(storageKey)}`,
    storageKey,
    publicUrl: `/uploads/${storageKey}`,
    isDirectUpload: false,
  };
}

/**
 * Saves a local buffer for development fallback mode.
 */
export async function saveLocalMediaFile(storageKey: string, buffer: Buffer): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", path.dirname(storageKey));
  await fs.promises.mkdir(uploadDir, { recursive: true });
  
  const fullFilePath = path.join(process.cwd(), "public", "uploads", storageKey);
  await fs.promises.writeFile(fullFilePath, buffer);
  
  return `/uploads/${storageKey}`;
}

/**
 * Deletes a file from R2 or local storage.
 */
export async function deleteMediaFile(storageKey: string): Promise<void> {
  if (s3Client && isR2Configured) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: storageKey,
        })
      );
    } catch (err) {
      console.error("Failed to delete R2 object:", err);
    }
  } else {
    try {
      const fullFilePath = path.join(process.cwd(), "public", "uploads", storageKey);
      if (fs.existsSync(fullFilePath)) {
        await fs.promises.unlink(fullFilePath);
      }
    } catch (err) {
      console.error("Failed to delete local media file:", err);
    }
  }
}
