import crypto from "crypto";

export interface RazorpayConfigStatus {
  isConfigured: boolean;
  isTestMode: boolean;
  hasWebhookSecret: boolean;
  publicKeyId: string | null;
  missingEnvVars: string[];
}

const PLACEHOLDERS = [
  "rzp_test_your_key_id",
  "your_razorpay_key_secret",
  "your_razorpay_webhook_secret",
  "plan_your_",
];

function isRealValue(val?: string): boolean {
  const trimmed = (val || "").trim();
  if (!trimmed || trimmed.length < 6) return false;
  return !PLACEHOLDERS.some((p) => trimmed.startsWith(p));
}

export function getRazorpayConfig(): RazorpayConfigStatus {
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const publicKeyId = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId).trim();

  const missingEnvVars: string[] = [];
  if (!isRealValue(keyId)) missingEnvVars.push("RAZORPAY_KEY_ID");
  if (!isRealValue(keySecret)) missingEnvVars.push("RAZORPAY_KEY_SECRET");
  if (!isRealValue(webhookSecret)) missingEnvVars.push("RAZORPAY_WEBHOOK_SECRET");

  const isConfigured = isRealValue(keyId) && isRealValue(keySecret);
  const isTestMode = !isConfigured || keyId.startsWith("rzp_test_");

  return {
    isConfigured,
    isTestMode,
    hasWebhookSecret: isRealValue(webhookSecret),
    publicKeyId: isConfigured ? publicKeyId : null,
    missingEnvVars,
  };
}

export function getRazorpayPlanIdFromEnv(
  planCode: string,
  interval: "MONTHLY" | "ANNUAL"
): string | null {
  const code = planCode.toUpperCase();
  const key = `RAZORPAY_PLAN_${code}_${interval}`;
  const val = process.env[key]?.trim();
  return isRealValue(val) ? val! : null;
}

function getAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!isRealValue(keyId) || !isRealValue(keySecret)) {
    throw new Error("Razorpay API credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Checkout payment callbacks.
 * - For Subscriptions: HMAC_SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret)
 * - For One-Time Orders: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
export function verifyRazorpayPaymentSignature(params: {
  razorpayPaymentId: string;
  razorpaySubscriptionId?: string;
  razorpayOrderId?: string;
  razorpaySignature: string;
  keySecretOverride?: string;
}): boolean {
  const secret = (params.keySecretOverride ?? process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  if (!secret || !params.razorpayPaymentId || !params.razorpaySignature) {
    return false;
  }

  let payload: string;
  if (params.razorpaySubscriptionId) {
    payload = `${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`;
  } else if (params.razorpayOrderId) {
    payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  } else {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(params.razorpaySignature.trim(), "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification for incoming Razorpay Webhook requests.
 * Computes HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) and compares against `x-razorpay-signature`.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecretOverride?: string
): boolean {
  const secret = (webhookSecretOverride ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader.trim(), "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function createRazorpaySubscription(params: {
  razorpayPlanId: string;
  totalCount: number;
  notes: Record<string, string>;
}): Promise<{
  id: string;
  status: string;
  short_url?: string;
  plan_id: string;
}> {
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: params.razorpayPlanId,
      total_count: params.totalCount,
      customer_notify: 1,
      notes: params.notes,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(
      data?.error?.description || `Razorpay subscription creation failed (HTTP ${res.status})`
    );
  }
  return data;
}

export async function fetchRazorpaySubscription(razorpaySubscriptionId: string): Promise<{
  id: string;
  status: string;
  plan_id: string;
  customer_id?: string;
  current_start?: number;
  current_end?: number;
  notes?: Record<string, string>;
}> {
  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(razorpaySubscriptionId)}`,
    {
      headers: { Authorization: getAuthHeader() },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data?.error?.description || "Failed to fetch Razorpay subscription");
  }
  return data;
}

export async function fetchRazorpayPayment(razorpayPaymentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  invoice_id?: string;
  error_description?: string;
}> {
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
    {
      headers: { Authorization: getAuthHeader() },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data?.error?.description || "Failed to fetch Razorpay payment");
  }
  return data;
}

export async function cancelRazorpaySubscription(
  razorpaySubscriptionId: string,
  cancelAtCycleEnd: boolean = true
) {
  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(razorpaySubscriptionId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || "Failed to cancel Razorpay subscription");
  }
  return data;
}
