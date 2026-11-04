// Stripe helpers shared by billing, billing-webhook and delete-account.
// Plain fetch against Stripe's REST API (no SDK) to keep cold starts small.
// The pure functions here (signature check, status mapping, which event
// wins) are unit-tested in stripe.test.ts.

const TOLERANCE_SECONDS = 300;

export const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export function isActive(status: string | null | undefined): boolean {
  return !!status && (ACTIVE_STATUSES as readonly string[]).includes(status);
}

// --- Webhook signature (Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]) ---

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Stripe webhook signature: HMAC-SHA256 over `t.payload`, any
 * v1 signature may match (Stripe sends several during secret rotation),
 * and the timestamp must be within 5 minutes either way (replay window).
 */
export async function verifySignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds = Date.now() / 1000,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return parts
    .filter((part) => part.startsWith("v1="))
    .some((part) => timingSafeEqual(part.slice(3), expected));
}

/** Test helper and documentation of the format: builds a valid header. */
export async function signForTest(payload: string, secret: string, timestamp: number) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`;
}

// --- Subscription state ---

/** Stripe status -> our status. Anything not active/trialing/past_due/canceled is "inactive". */
export function toStatus(stripeStatus: string): string {
  if (isActive(stripeStatus)) return stripeStatus;
  if (stripeStatus === "canceled") return "canceled";
  return "inactive";
}

export function planFor(status: string): "pro" | "free" {
  return isActive(status) ? "pro" : "free";
}

type Stored = { stripe_subscription_id: string | null; status: string } | null;

/**
 * One plan row per user, but a user can (briefly, or by mistake) have more
 * than one Stripe subscription. An event for a *different* subscription may
 * only replace the stored one if it's active - otherwise cancelling an old
 * duplicate would flip a paying user back to Free.
 */
export function shouldApply(stored: Stored, incoming: { id: string; status: string }): boolean {
  if (!stored?.stripe_subscription_id) return true;
  if (stored.stripe_subscription_id === incoming.id) return true;
  if (!isActive(stored.status)) return true;
  return isActive(toStatus(incoming.status));
}

// --- REST calls ---

export async function stripeRequest(
  key: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, string>,
  idempotencyKey?: string,
): Promise<Response> {
  const query = method === "GET" && params ? `?${new URLSearchParams(params)}` : "";
  return await fetch(`https://api.stripe.com/v1/${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" && params ? new URLSearchParams(params) : undefined,
  });
}

const STRIPE_ID = /^(cus|sub)_[A-Za-z0-9]+$/;

/**
 * Deletes a Stripe customer: cancels every subscription they have and
 * removes their personal data from Stripe (UK GDPR erasure). 404 counts as
 * done. Returns false on any other failure.
 */
export async function deleteCustomer(key: string, customerId: string): Promise<boolean> {
  if (!STRIPE_ID.test(customerId)) return false;
  const response = await stripeRequest(key, "DELETE", `customers/${customerId}`);
  return response.ok || response.status === 404;
}
