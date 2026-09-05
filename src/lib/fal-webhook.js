import crypto from "node:crypto";

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SKEW_SECONDS = 5 * 60;

let jwksCache = { keys: null, fetchedAt: 0 };

export async function fetchFalJwks(force = false) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = await res.json();
  jwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

/** Message fal signs: request id, user id, timestamp and the SHA-256 hex of the raw body, newline separated. */
export function buildFalWebhookMessage({ requestId, userId, timestamp, rawBody }) {
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  return Buffer.from([requestId, userId, timestamp, bodyHash].join("\n"), "utf8");
}

/**
 * Verify a fal.ai webhook (ED25519). `headers` is anything with a `.get(name)`.
 * Pass `keys` (JWK array) and `now` (ms) in tests to avoid the network and clock.
 */
export async function verifyFalWebhook(headers, rawBody, { keys, now } = {}) {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signatureHex = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signatureHex) return false;

  const ts = Number(timestamp);
  const nowSec = (now ?? Date.now()) / 1000;
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return false;

  if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) return false;
  const signature = Buffer.from(signatureHex, "hex");

  const message = buildFalWebhookMessage({ requestId, userId, timestamp, rawBody });
  const jwks = keys ?? (await fetchFalJwks());

  for (const jwk of jwks) {
    try {
      const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
      if (crypto.verify(null, message, key, signature)) return true;
    } catch {
      // unsupported key type in the set; try the next one
    }
  }
  return false;
}
