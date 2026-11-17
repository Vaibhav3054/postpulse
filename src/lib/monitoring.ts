/**
 * Lightweight, zero-dependency structured error monitoring & observability adapter.
 *
 * - Always emits structured JSON logs (picked up automatically by Netlify Function Logs).
 * - Automatically redacts sensitive fields (secrets, tokens, passwords, cookies, headers).
 * - Optionally forwards critical errors to ALERT_WEBHOOK_URL (Slack/Discord/PagerDuty)
 *   or SENTRY_DSN via lightweight HTTPS envelope with a strict 2-second timeout.
 */

const SENSITIVE_KEY_RE =
  /(password|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|signature)/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[Truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export interface MonitoringContext {
  route?: string;
  userId?: string;
  workspaceId?: string;
  level?: "info" | "warn" | "error" | "fatal";
  extra?: Record<string, unknown>;
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs = 2000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // Never let monitoring delivery failures break application requests
  } finally {
    clearTimeout(timer);
  }
}

async function sendToSentryDsn(
  dsn: string,
  payload: {
    message: string;
    name: string;
    stack?: string;
    level: string;
    context: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) return;

    const envelopeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`;
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const header = JSON.stringify({
      event_id: eventId,
      dsn,
      sent_at: new Date().toISOString(),
    });
    const itemHeader = JSON.stringify({ type: "event" });
    const eventBody = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      level: payload.level,
      platform: "node",
      environment: process.env.NODE_ENV || "production",
      message: `${payload.name}: ${payload.message}`,
      extra: {
        ...payload.context,
        stack: payload.stack,
      },
    });

    await postWithTimeout(envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=postpulse-monitor/1.0`,
      },
      body: `${header}\n${itemHeader}\n${eventBody}`,
    });
  } catch {
    // Ignore malformed DSN or transient network errors
  }
}

export function isErrorMonitoringConfigured(): boolean {
  const sentry = (process.env.SENTRY_DSN || "").trim();
  const webhook = (process.env.ALERT_WEBHOOK_URL || "").trim();
  return Boolean(
    (sentry && sentry.startsWith("http") && !sentry.includes("your_sentry")) ||
      (webhook && webhook.startsWith("http") && !webhook.includes("your_webhook"))
  );
}

/**
 * Captures and logs an application exception with structured redaction and optional webhook/Sentry dispatch.
 */
export async function captureException(
  err: unknown,
  context: MonitoringContext = {}
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  const level = context.level || "error";
  const safeExtra = sanitizeValue(context.extra || {}) as Record<string, unknown>;

  const record = {
    ts: new Date().toISOString(),
    service: "postpulse",
    env: process.env.NODE_ENV || "development",
    level,
    route: context.route || "unknown",
    userId: context.userId || undefined,
    workspaceId: context.workspaceId || undefined,
    errorName: error.name,
    errorMessage: error.message,
    stack: process.env.NODE_ENV === "production" ? error.stack?.split("\n").slice(0, 6).join("\n") : error.stack,
    extra: safeExtra,
  };

  console.error(JSON.stringify(record));

  const sentryDsn = (process.env.SENTRY_DSN || "").trim();
  if (sentryDsn && sentryDsn.startsWith("http") && !sentryDsn.includes("your_sentry")) {
    await sendToSentryDsn(sentryDsn, {
      name: error.name,
      message: error.message,
      stack: record.stack,
      level,
      context: {
        route: record.route,
        userId: record.userId,
        workspaceId: record.workspaceId,
        extra: safeExtra,
      },
    });
  }

  const webhookUrl = (process.env.ALERT_WEBHOOK_URL || "").trim();
  if (
    (level === "error" || level === "fatal") &&
    webhookUrl &&
    webhookUrl.startsWith("http") &&
    !webhookUrl.includes("your_webhook")
  ) {
    await postWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[PostPulse ${level.toUpperCase()}] ${record.route}: ${error.name} — ${error.message}`,
        ...record,
      }),
    });
  }
}

export function captureMessage(message: string, context: MonitoringContext = {}): void {
  const level = context.level || "info";
  const record = {
    ts: new Date().toISOString(),
    service: "postpulse",
    env: process.env.NODE_ENV || "development",
    level,
    route: context.route || "app",
    userId: context.userId || undefined,
    workspaceId: context.workspaceId || undefined,
    message,
    extra: sanitizeValue(context.extra || {}),
  };

  if (level === "warn") {
    console.warn(JSON.stringify(record));
  } else if (level === "error" || level === "fatal") {
    console.error(JSON.stringify(record));
  } else {
    console.info(JSON.stringify(record));
  }
}
