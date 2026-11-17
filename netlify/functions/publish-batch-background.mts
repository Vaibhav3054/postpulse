/**
 * Netlify Background Function — Overflow Publishing Batch Drainer
 *
 * Runs up to 15 minutes in the background when a high-volume minute has more than
 * MAX_BATCH_TARGETS due scheduled posts. Authenticated strictly via CRON_SECRET.
 */

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

export default async function handler(req: Request) {
  const cronSecret = Netlify.env.get("CRON_SECRET")?.trim();
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const siteUrl = (
    Netlify.env.get("APP_URL") ||
    Netlify.env.get("URL") ||
    Netlify.env.get("DEPLOY_PRIME_URL") ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!siteUrl) return new Response("Missing site URL", { status: 500 });

  // Drain up to 10 consecutive batches safely inside the 15-minute ceiling
  for (let pass = 1; pass <= 10; pass++) {
    const res = await fetch(`${siteUrl}/api/publishing/dispatch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Background Publish] Pass ${pass} failed with HTTP ${res.status}`);
      break;
    }

    const data = (await res.json().catch(() => ({}))) as {
      processedCount?: number;
      hasMore?: boolean;
    };
    console.log(
      `[Background Publish] Pass ${pass}: processed=${data.processedCount ?? 0} hasMore=${Boolean(data.hasMore)}`
    );

    if (!data.hasMore) break;
  }

  return new Response("OK", { status: 200 });
}

export const config = {
  background: true,
};
