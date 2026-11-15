import { NextRequest, NextResponse } from "next/server";
import { dispatchDueScheduledPosts } from "@/lib/queue/publishing-queue";

export async function POST(req: NextRequest) {
  try {
    // Secret verification for external cron triggers if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await dispatchDueScheduledPosts();
    return NextResponse.json({ success: true, processedCount: result.processedCount });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Dispatch failed" }, { status: 500 });
  }
}
