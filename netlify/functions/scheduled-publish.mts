/**
 * Netlify Scheduled Function — Automated 24/7 Post Publishing Dispatcher
 *
 * Schedule: Every 1 minute ("* * * * *" UTC) on published Netlify deploys.
 * Constraints verified against Netlify Functions documentation:
 *  - Scheduled Functions execute up to 30 seconds max.
 *  - Only run on published production deploys (not Deploy Previews).
 *  - Zero extra infrastructure cost (included in Netlify hosting).
 *
 * If a high-volume minute has remaining queued items (`hasMore: true`), this function
 * hands off overflow draining to `publish-batch-background` (15-minute ceiling).
 */

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

export default async function handler(req: Request) {
  let nextRun = "unknown";
  try {
    const body = (await req.json()) as { next_run?: string };
    if (body?.next_run) nextRun = body.next_run;
  } catch {
    // Ignore empty body during manual invocation
  }

  const cronSecret = Netlify.env.get("CRON_SECRET")?.trim();
  const siteUrl = (
    Netlify.env.get("APP_URL") ||
    Netlify.env.get("URL") ||
    Netlify.env.get("DEPLOY_PRIME_URL") ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!cronSecret || !siteUrl) {
    console.error(
      "[Netlify Scheduled Publish] Missing CRON_SECRET or APP_URL/URL environment variable."
    );
    return new Response(
      JSON.stringify({ ok: false, error: "CRON_SECRET or APP_URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000); // Stay safely under Netlify's 30s limit

  try {
    const res = await fetch(`${siteUrl}/api/publishing/dispatch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      processedCount?: number;
      publishedCount?: number;
      failedCount?: number;
      retryingCount?: number;
      hasMore?: boolean;
      error?: string;
    };

    console.log(
      `[Netlify Scheduled Publish] HTTP ${res.status} | processed=${data.processedCount ?? 0} published=${data.publishedCount ?? 0} retrying=${data.retryingCount ?? 0} failed=${data.failedCount ?? 0} next_run=${nextRun}`
    );

    // If burst traffic left additional due posts, trigger 15-minute Background Function cleanly
    if (res.ok && data.hasMore) {
      fetch(`${siteUrl}/.netlify/functions/publish-batch-background`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "scheduled_overflow" }),
      }).catch((bgErr) => {
        console.error("[Netlify Scheduled Publish] Failed to trigger background overflow:", bgErr);
      });
    }

    return new Response(JSON.stringify({ ok: res.ok, ...data, nextRun }), {
      status: res.ok ? 200 : res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Netlify Scheduled Publish] Dispatch error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const config = {
  schedule: "* * * * *",
};
