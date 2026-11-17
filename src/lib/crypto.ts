import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

const INSECURE_DEFAULTS = new Set([
  "default_development_secret_key_32_bytes_long_exact!",
  "your_32_byte_hex_encryption_secret_must_be_64_characters",
]);

let devKeyWarned = false;

/**
 * Derives a 32-byte key from TOKEN_ENCRYPTION_SECRET.
 * In production, strictly enforces a configured 64-char hex (32-byte) secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (!secret || INSECURE_DEFAULTS.has(secret)) {
    if (isProd) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION ERROR: TOKEN_ENCRYPTION_SECRET must be set to a 64-character hex string (32 bytes) in production."
      );
    }
    if (!devKeyWarned) {
      devKeyWarned = true;
      console.warn(
        "[Security Warning] TOKEN_ENCRYPTION_SECRET is unset in development. Set a 64-char hex key in .env."
      );
    }
    return crypto
      .createHash("sha256")
      .update("dev_only_local_token_encryption_key_do_not_use_in_prod")
      .digest();
  }

  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  if (isProd) {
    throw new Error(
      "FATAL SECURITY CONFIGURATION ERROR: TOKEN_ENCRYPTION_SECRET must be exactly 64 hexadecimal characters (32 bytes) in production."
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive string (such as an OAuth access token or refresh token) using AES-256-GCM.
 * Output format: iv:authTag:encryptedData (hex encoded)
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 */
export function decryptToken(encryptedString: string): string {
  if (!encryptedString) return "";
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token payload format.");
  }

  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
