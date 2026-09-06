import crypto from "node:crypto";

// Resend signs webhooks with the Svix / Standard Webhooks scheme:
//   HMAC-SHA256( base64decode(secret without "whsec_"), `${id}.${timestamp}.${rawBody}` ) → base64,
// sent as `svix-signature: v1,<sig> [v1,<sig2> …]` next to `svix-id` and `svix-timestamp`.
const MAX_SKEW_SECONDS = 5 * 60;

function header(headers, ...names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

export function decodeWebhookSecret(secret) {
  if (typeof secret !== "string" || !secret) return null;
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  try {
    const key = Buffer.from(raw, "base64");
    return key.length ? key : null;
  } catch {
    return null;
  }
}

export function signResendWebhook({ id, timestamp, rawBody, secret }) {
  const key = decodeWebhookSecret(secret);
  if (!key) throw new Error("Invalid webhook secret");
  return crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`, "utf8").digest("base64");
}

/**
 * Verify a Resend webhook. `headers` is anything with a `.get(name)` (Next's Headers, a Map wrapper in tests).
 * Accepts the Svix header names and the Standard Webhooks aliases. Pass `now` (ms) in tests.
 */
export function verifyResendWebhook(headers, rawBody, secret, { now } = {}) {
  const id = header(headers, "svix-id", "webhook-id");
  const timestamp = header(headers, "svix-timestamp", "webhook-timestamp");
  const signatures = header(headers, "svix-signature", "webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  const ts = Number(timestamp);
  const nowSec = (now ?? Date.now()) / 1000;
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return false;

  let expected;
  try {
    expected = Buffer.from(signResendWebhook({ id, timestamp, rawBody, secret }), "base64");
  } catch {
    return false;
  }

  for (const entry of signatures.split(" ")) {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) continue;
    const candidate = Buffer.from(sig, "base64");
    if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

/** Normalise an `email.received` event into what the forwarder needs; null for anything else. */
export function parseReceivedEvent(payload) {
  if (!payload || payload.type !== "email.received" || !payload.data?.email_id) return null;
  const data = payload.data;
  return {
    emailId: String(data.email_id),
    from: typeof data.from === "string" ? data.from : "",
    to: Array.isArray(data.to) ? data.to.filter((x) => typeof x === "string") : [],
    subject: typeof data.subject === "string" ? data.subject : "",
    attachments: Array.isArray(data.attachments) ? data.attachments.length : 0,
  };
}
