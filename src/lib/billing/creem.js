// Creem (creem.io) — merchant of record that onboards individual sellers (incl. mainland China)
// and pays out by bank transfer / Stripe Connect / USDC. It handles VAT/sales tax for us.
import crypto from "node:crypto";
import config from "../config.js";

export function creemConfigured() {
  const key = config.payments.creem.apiKey;
  return typeof key === "string" && key.trim().length > 10;
}

/**
 * Create a hosted checkout for one credit pack.
 * Docs: POST {apiBase}/v1/checkouts with x-api-key. `request_id` is our idempotency key and comes back
 * in the webhook; `metadata` is passed through as well.
 */
export async function createCreemCheckout({ user, plan, requestId, successUrl }) {
  if (!creemConfigured()) throw new Error("Creem is not configured (CREEM_API_KEY)");
  if (!plan?.creemProductId) throw new Error(`Creem product id missing for plan "${plan?.id}" (CREEM_PRODUCT_*)`);

  const res = await fetch(`${config.payments.creem.apiBase}/v1/checkouts`, {
    method: "POST",
    headers: { "x-api-key": config.payments.creem.apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      product_id: plan.creemProductId,
      request_id: requestId,
      success_url: successUrl,
      customer: user.email ? { email: user.email } : undefined,
      metadata: { userId: user.id, planId: plan.id, credits: String(plan.credits) },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Creem checkout failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.checkout_url) throw new Error("Creem did not return a checkout_url");
  return { url: data.checkout_url, checkoutId: data.id };
}

/** `creem-signature` = hex(HMAC-SHA256(webhookSecret, rawBody)). Constant-time compare. */
export function verifyCreemSignature(rawBody, signature, secret = config.payments.creem.webhookSecret) {
  if (!secret || !signature || typeof signature !== "string") return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Normalise a Creem webhook into what the credit ledger needs. Returns null for events we ignore.
 * Payload shape: { id, eventType: "checkout.completed", object: { id, request_id, metadata, order: { id, amount, currency, status }, … } }
 */
export function parseCreemEvent(payload) {
  const type = payload?.eventType || payload?.type;
  if (type !== "checkout.completed") return null;

  const obj = payload.object || {};
  const order = obj.order || {};
  const metadata = obj.metadata || order.metadata || {};
  const orderId = order.id || obj.id;
  if (!orderId) return null;
  if (order.status && !["paid", "completed", "succeeded"].includes(String(order.status).toLowerCase())) return null;

  return {
    provider: "creem",
    providerOrderId: String(orderId),
    checkoutId: obj.id ? String(obj.id) : null,
    requestId: obj.request_id || null,
    userId: metadata.userId ? String(metadata.userId) : null,
    planId: metadata.planId ? String(metadata.planId) : null,
    credits: Number(metadata.credits) || 0,
    amountCents: Number.isFinite(Number(order.amount)) ? Number(order.amount) : null,
    currency: order.currency ? String(order.currency).toUpperCase() : null,
  };
}
