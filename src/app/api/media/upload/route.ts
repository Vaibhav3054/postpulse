import { NextRequest, NextResponse } from "next/server";
import { saveMediaFile } from "@/lib/storage";

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storageKey = searchParams.get("key");
    const mimeType = searchParams.get("mime") || "image/jpeg";

    if (!storageKey) {
      return NextResponse.json({ error: "Storage key missing" }, { status: 400 });
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await saveMediaFile(storageKey, buffer, mimeType);

    return NextResponse.json({ success: true, publicUrl });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Failed to save file" }, { status: 500 });
  }
}
