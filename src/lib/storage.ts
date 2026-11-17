import path from "path";
import fs from "fs";
import { parseAndValidateStorageKey } from "./validation";

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export interface StorageConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  isSupabaseConfigured: boolean;
  isProduction: boolean;
}

export function getStorageConfig(): StorageConfig {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = (process.env.STORAGE_BUCKET || "").trim();
  const isProduction = process.env.NODE_ENV === "production";

  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
      !supabaseUrl.includes("[PROJECT_ID]") &&
      serviceRoleKey &&
      serviceRoleKey !== "your_service_role_key" &&
      serviceRoleKey !== "your_supabase_service_role_secret" &&
      bucket &&
      bucket !== "your_storage_bucket_name"
  );

  return {
    supabaseUrl,
    serviceRoleKey,
    bucket,
    isSupabaseConfigured,
    isProduction,
  };
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  isDirectUpload: boolean;
  storageDriver: "supabase" | "local_dev";
}

/**
 * Computes the canonical public URL for a validated storageKey.
 */
export function buildPublicUrlForStorageKey(storageKey: string): string {
  if (!parseAndValidateStorageKey(storageKey).valid) {
    throw new Error("Invalid storage key format.");
  }

  const cfg = getStorageConfig();
  if (cfg.isSupabaseConfigured) {
    return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${storageKey}`;
  }

  if (cfg.isProduction) {
    throw new StorageConfigurationError(
      "Supabase Storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STORAGE_BUCKET in production."
    );
  }

  return `/uploads/${storageKey}`;
}

/**
 * Generates an authenticated upload URL routed through /api/media/upload for cloud persistence.
 */
export async function generateUploadUrl(
  workspaceId: string,
  fileName: string,
  mimeType: string
): Promise<PresignedUploadResponse> {
  const cfg = getStorageConfig();

  if (!cfg.isSupabaseConfigured && cfg.isProduction) {
    throw new StorageConfigurationError(
      "Supabase Storage is required in production. Please configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STORAGE_BUCKET."
    );
  }

  const cleanBase = path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 120);
  const safeFileName = cleanBase || "upload.bin";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const storageKey = `workspaces/${workspaceId}/${uniqueId}-${safeFileName}`;

  if (cfg.isSupabaseConfigured) {
    const publicUrl = `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${storageKey}`;
    return {
      uploadUrl: `/api/media/upload?key=${encodeURIComponent(storageKey)}&mime=${encodeURIComponent(mimeType)}`,
      storageKey,
      publicUrl,
      isDirectUpload: false,
      storageDriver: "supabase",
    };
  }

  // Strictly local development fallback (never reachable in production)
  return {
    uploadUrl: `/api/media/upload?key=${encodeURIComponent(storageKey)}&mime=${encodeURIComponent(mimeType)}`,
    storageKey,
    publicUrl: `/uploads/${storageKey}`,
    isDirectUpload: false,
    storageDriver: "local_dev",
  };
}

/**
 * Saves a buffer to Supabase Storage.
 * In production, local disk fallback is disabled — Supabase errors fail fast cleanly.
 */
export async function saveMediaFile(
  storageKey: string,
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<string> {
  if (!parseAndValidateStorageKey(storageKey).valid) {
    throw new Error("Invalid storage key format.");
  }

  const cfg = getStorageConfig();

  if (cfg.isSupabaseConfigured) {
    const endpoint = `${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}/${storageKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        apikey: cfg.serviceRoleKey,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      console.error("[Supabase Storage] Upload failed:", res.status, errorText);
      throw new Error(`Cloud storage upload failed (${res.status}): ${errorText || "Unknown error"}`);
    }

    return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${storageKey}`;
  }

  if (cfg.isProduction) {
    throw new StorageConfigurationError(
      "Supabase Storage is required in production. Local disk writes are disabled on serverless runtimes."
    );
  }

  // Local development fallback ONLY (NODE_ENV !== "production")
  const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
  const fullFilePath = path.resolve(uploadRoot, storageKey);
  if (!fullFilePath.startsWith(uploadRoot + path.sep)) {
    throw new Error("Invalid storage path.");
  }

  await fs.promises.mkdir(path.dirname(fullFilePath), { recursive: true });
  await fs.promises.writeFile(fullFilePath, buffer);

  return `/uploads/${storageKey}`;
}

/**
 * Deletes a file from Supabase Storage (or local disk in non-production dev).
 */
export async function deleteMediaFile(storageKey: string): Promise<void> {
  if (!parseAndValidateStorageKey(storageKey).valid) {
    throw new Error("Invalid storage key format.");
  }

  const cfg = getStorageConfig();

  if (cfg.isSupabaseConfigured) {
    const endpoint = `${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}`;
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        apikey: cfg.serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [storageKey] }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      console.error("[Supabase Storage] Delete failed:", res.status, errorText);
      throw new Error(`Cloud storage delete failed (${res.status}): ${errorText}`);
    }
    return;
  }

  if (cfg.isProduction) {
    throw new StorageConfigurationError(
      "Supabase Storage is not configured in production; cannot delete storage object."
    );
  }

  const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
  const fullFilePath = path.resolve(uploadRoot, storageKey);
  if (!fullFilePath.startsWith(uploadRoot + path.sep)) {
    throw new Error("Invalid storage path.");
  }

  if (fs.existsSync(fullFilePath)) {
    await fs.promises.unlink(fullFilePath);
  }
}
