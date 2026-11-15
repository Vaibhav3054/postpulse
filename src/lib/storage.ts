import path from "path";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hnadzkwmadcpdqzmjmet.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "postpulse-assets";

const isSupabaseStorageConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_SERVICE_ROLE_KEY &&
  SUPABASE_SERVICE_ROLE_KEY !== "your_service_role_key"
);

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  isDirectUpload: boolean;
}

/**
 * Generates an upload URL (routes through /api/media/upload for secure cloud persistence)
 */
export async function generateUploadUrl(
  workspaceId: string,
  fileName: string,
  mimeType: string
): Promise<PresignedUploadResponse> {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const storageKey = `workspaces/${workspaceId}/${uniqueId}-${sanitizedFileName}`;

  if (isSupabaseStorageConfigured) {
    const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/${storageKey}`;
    return {
      uploadUrl: `/api/media/upload?key=${encodeURIComponent(storageKey)}&mime=${encodeURIComponent(mimeType)}`,
      storageKey,
      publicUrl,
      isDirectUpload: false,
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
 * Saves a buffer to Supabase Storage, or local disk as dev fallback.
 */
export async function saveMediaFile(
  storageKey: string,
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<string> {
  if (isSupabaseStorageConfigured) {
    try {
      const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${STORAGE_BUCKET}/${storageKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: new Uint8Array(buffer),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Supabase Storage upload error:", errorText);
      } else {
        return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/${storageKey}`;
      }
    } catch (err) {
      console.error("Exception uploading to Supabase Storage:", err);
    }
  }

  // Fallback to local storage
  const uploadDir = path.join(process.cwd(), "public", "uploads", path.dirname(storageKey));
  await fs.promises.mkdir(uploadDir, { recursive: true });
  const fullFilePath = path.join(process.cwd(), "public", "uploads", storageKey);
  await fs.promises.writeFile(fullFilePath, buffer);

  return `/uploads/${storageKey}`;
}

/**
 * Deletes a file from Supabase Storage or local disk.
 */
export async function deleteMediaFile(storageKey: string): Promise<void> {
  if (isSupabaseStorageConfigured) {
    try {
      const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${STORAGE_BUCKET}`;
      await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [storageKey] }),
      });
      return;
    } catch (err) {
      console.error("Failed to delete Supabase storage object:", err);
    }
  }

  try {
    const fullFilePath = path.join(process.cwd(), "public", "uploads", storageKey);
    if (fs.existsSync(fullFilePath)) {
      await fs.promises.unlink(fullFilePath);
    }
  } catch (err) {
    console.error("Failed to delete local media file:", err);
  }
}
