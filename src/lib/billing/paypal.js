// PayPal Checkout via the REST Orders v2 API (server-side redirect flow, no JS SDK):
// create order → send the buyer to PayPal → they return to /api/paypal/return?token=ORDER_ID →
// we capture → credits are granted. A PAYMENT.CAPTURE.COMPLETED webhook covers the case where
// the buyer closes the tab before the return page loads.
import config from "../config.js";

export function paypalConfigured() {
  const { clientId, clientSecret } = config.payments.paypal;
  return typeof clientId === "string" && clientId.length > 10 && typeof clientSecret === "string" && clientSecret.length > 10;
}

export function paypalApiBase() {
  return config.payments.paypal.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/** "5.00" style amount from integer cents. */
export function formatAmount(cents) {
  return (Math.round(Number(cents)) / 100).toFixed(2);
}

/** custom_id carries our reference: "<userId>|<planId>" (PayPal caps it at 127 chars). */
export function encodeCustomId(userId, planId) {
  return `${userId}|${planId}`.slice(0, 127);
}
export function parseCustomId(customId) {
  const [userId = "", planId = ""] = String(customId || "").split("|");
  return { userId: userId || null, planId: planId || null };
}

/** The buyer-facing URL from an order's links (new API uses "payer-action", classic uses "approve"). */
export function approvalLink(order) {
  const links = Array.isArray(order?.links) ? order.links : [];
  return (links.find((l) => l.rel === "payer-action") || links.find((l) => l.rel === "approve"))?.href || null;
}

let tokenCache = { token: null, expiresAt: 0 };
export async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const { clientId, clientSecret } = config.payments.paypal;
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3000) * 1000 };
  return tokenCache.token;
}

async function api(path, { method = "GET", body, requestId } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = data?.details?.[0]?.issue || data?.name || res.status;
    throw new Error(`PayPal ${method} ${path} failed: ${detail}`);
  }
  return data;
}

/** Create an order for one credit pack. Returns { orderId, url }. */
export async function createPayPalOrder({ user, plan, returnUrl, cancelUrl, requestId }) {
  if (!paypalConfigured()) throw new Error("PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  const order = await api("/v2/checkout/orders", {
    method: "POST",
    requestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: plan.id,
          custom_id: encodeCustomId(user.id, plan.id),
          description: `${plan.name} — ${plan.credits} credits for H3 Max Studio`,
          amount: { currency_code: "USD", value: formatAmount(plan.price) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: config.appName,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  });
  const url = approvalLink(order);
  if (!order.id || !url) throw new Error("PayPal did not return an approval link");
  return { orderId: order.id, url };
}

/** Capture an approved order. Returns the normalised capture, or null if PayPal reports it as not completed. */
export async function capturePayPalOrder(orderId) {
  let data;
  try {
    data = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", requestId: `cap-${orderId}` });
  } catch (err) {
    // Already captured (double click / webhook raced us): read the order instead.
    if (/ORDER_ALREADY_CAPTURED/.test(err.message)) data = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    else throw err;
  }
  return normaliseOrder(data);
}

export function normaliseOrder(order) {
  const unit = order?.purchase_units?.[0] || {};
  const capture = unit?.payments?.captures?.[0] || null;
  const amount = capture?.amount || unit?.amount || {};
  return {
    orderId: order?.id || null,
    status: capture?.status || order?.status || null, // COMPLETED when money moved
    captureId: capture?.id || null,
    amountCents: amount.value !== undefined ? Math.round(Number(amount.value) * 100) : null,
    currency: amount.currency_code || null,
    ...parseCustomId(capture?.custom_id || unit?.custom_id),
  };
}

/** Normalise a webhook event; only completed captures are returned, everything else → null. */
export function parseWebhookEvent(payload) {
  if (payload?.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
  const r = payload.resource || {};
  if (r.status && r.status !== "COMPLETED") return null;
  const orderId = r.supplementary_data?.related_ids?.order_id || null;
  if (!orderId) return null;
  return {
    orderId,
    status: "COMPLETED",
    captureId: r.id || null,
    amountCents: r.amount?.value !== undefined ? Math.round(Number(r.amount.value) * 100) : null,
    currency: r.amount?.currency_code || null,
    ...parseCustomId(r.custom_id),
  };
}

/** Ask PayPal to verify the webhook signature (needs PAYPAL_WEBHOOK_ID). */
export async function verifyPayPalWebhook(headers, rawBody) {
  const webhookId = config.payments.paypal.webhookId;
  if (!webhookId) return false;
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const h = (k) => headers.get(k);
  if (!h("paypal-transmission-id") || !h("paypal-transmission-sig") || !h("paypal-cert-url")) return false;
  const data = await api("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return data?.verification_status === "SUCCESS";
}
