import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyCreemSignature, parseCreemEvent } from "../src/lib/billing/creem.js";

const SECRET = "whsec_test_secret";
const body = JSON.stringify({
  id: "evt_1",
  eventType: "checkout.completed",
  object: {
    id: "ch_123",
    request_id: "h3max-user_1-starter-abc",
    metadata: { userId: "user_1", planId: "starter", credits: "500" },
    order: { id: "ord_9", amount: 500, currency: "usd", status: "paid" },
  },
});
const sign = (b, s = SECRET) => crypto.createHmac("sha256", s).update(b).digest("hex");

test("accepts a correct HMAC and rejects wrong/missing ones", () => {
  assert.equal(verifyCreemSignature(body, sign(body), SECRET), true);
  assert.equal(verifyCreemSignature(body, sign(body).toUpperCase(), SECRET), true);
  assert.equal(verifyCreemSignature(body, sign(body, "other"), SECRET), false);
  assert.equal(verifyCreemSignature(body + " ", sign(body), SECRET), false);
  assert.equal(verifyCreemSignature(body, null, SECRET), false);
  assert.equal(verifyCreemSignature(body, sign(body), ""), false);
});

test("parses checkout.completed into a ledger entry", () => {
  const ev = parseCreemEvent(JSON.parse(body));
  assert.deepEqual(ev, {
    provider: "creem",
    providerOrderId: "ord_9",
    checkoutId: "ch_123",
    requestId: "h3max-user_1-starter-abc",
    userId: "user_1",
    planId: "starter",
    credits: 500,
    amountCents: 500,
    currency: "USD",
  });
});

test("ignores other events and unpaid orders", () => {
  assert.equal(parseCreemEvent({ eventType: "subscription.active", object: {} }), null);
  const unpaid = JSON.parse(body);
  unpaid.object.order.status = "pending";
  assert.equal(parseCreemEvent(unpaid), null);
  assert.equal(parseCreemEvent({ eventType: "checkout.completed", object: {} }), null);
});
