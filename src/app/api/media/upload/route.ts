import { NextRequest, NextResponse } from "next/server";
import { saveMediaFile } from "@/lib/storage";
import { requireApiSession, requireWorkspaceMember } from "@/lib/authorization";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  parseAndValidateStorageKey,
} from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function PUT(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const clientIp = getClientIp(req);
  const rateResult = await checkRateLimit(
    `media:upload:${auth.user.id}:${clientIp}`,
    60,
    10 * 60 * 1000
  );
  if (!rateResult.allowed) {
    return rateLimitExceededResponse(rateResult, "Too many file uploads. Please wait and try again.");
  }

  try {
    const { searchParams } = new URL(req.url);
    const storageKey = searchParams.get("key") || "";
    const rawMime = (
      searchParams.get("mime") ||
      req.headers.get("content-type") ||
      "image/jpeg"
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    const parsedKey = parseAndValidateStorageKey(storageKey);
    if (!parsedKey.valid || !parsedKey.workspaceId) {
      return NextResponse.json(
        { error: "Invalid storage key format." },
        { status: 400 }
      );
    }

    const memberCheck = await requireWorkspaceMember(parsedKey.workspaceId, auth.user.id);
    if (memberCheck.error) return memberCheck.error;

    if (!ALLOWED_MEDIA_MIME_TYPES.has(rawMime)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${rawMime}. Allowed types: JPEG, PNG, WebP, GIF, MP4, MOV, WebM.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    const maxBytes = rawMime.startsWith("video/") ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (buffer.length > maxBytes) {
      return NextResponse.json(
        {
          error: `File exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))} MB).`,
        },
        { status: 413 }
      );
    }

    const publicUrl = await saveMediaFile(storageKey, buffer, rawMime);

    return NextResponse.json({ success: true, publicUrl });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to save file" }, { status: 500 });
  }
}
