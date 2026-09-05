import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyFalWebhook, buildFalWebhookMessage } from "../src/lib/fal-webhook.js";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const jwk = publicKey.export({ format: "jwk" });
const otherJwk = crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" });

const NOW = 1_800_000_000_000; // fixed clock (ms)

function signedHeaders(rawBody, overrides = {}) {
  const fields = {
    requestId: "req_123",
    userId: "user_abc",
    timestamp: String(Math.floor(NOW / 1000)),
    ...overrides,
  };
  const message = buildFalWebhookMessage({ ...fields, rawBody });
  const signature = crypto.sign(null, message, privateKey).toString("hex");
  const map = new Map([
    ["x-fal-webhook-request-id", fields.requestId],
    ["x-fal-webhook-user-id", fields.userId],
    ["x-fal-webhook-timestamp", fields.timestamp],
    ["x-fal-webhook-signature", overrides.signature ?? signature],
  ]);
  return { get: (k) => map.get(k.toLowerCase()) ?? null };
}

const body = JSON.stringify({ request_id: "req_123", status: "OK", payload: { video: { url: "https://v3.fal.media/x.mp4" } } });

test("accepts a valid signature from a key in the JWKS", async () => {
  assert.equal(await verifyFalWebhook(signedHeaders(body), body, { keys: [otherJwk, jwk], now: NOW }), true);
});

test("rejects a tampered body", async () => {
  const headers = signedHeaders(body);
  assert.equal(await verifyFalWebhook(headers, body.replace("OK", "ERROR"), { keys: [jwk], now: NOW }), false);
});

test("rejects when the signing key is not in the JWKS", async () => {
  assert.equal(await verifyFalWebhook(signedHeaders(body), body, { keys: [otherJwk], now: NOW }), false);
});

test("rejects stale timestamps and missing headers", async () => {
  const stale = signedHeaders(body, { timestamp: String(Math.floor(NOW / 1000) - 3600) });
  assert.equal(await verifyFalWebhook(stale, body, { keys: [jwk], now: NOW }), false);
  assert.equal(await verifyFalWebhook({ get: () => null }, body, { keys: [jwk], now: NOW }), false);
});

test("rejects malformed signatures without throwing", async () => {
  const bad = signedHeaders(body, { signature: "zz" });
  assert.equal(await verifyFalWebhook(bad, body, { keys: [jwk], now: NOW }), false);
});
