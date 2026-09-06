import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, encodeCustomId, parseCustomId, approvalLink, normaliseOrder, parseWebhookEvent } from "../src/lib/billing/paypal.js";

test("amount formatting and custom id round-trip", () => {
  assert.equal(formatAmount(500), "5.00");
  assert.equal(formatAmount(1999), "19.99");
  assert.equal(encodeCustomId("user_1", "starter"), "user_1|starter");
  assert.deepEqual(parseCustomId("user_1|starter"), { userId: "user_1", planId: "starter" });
  assert.deepEqual(parseCustomId(""), { userId: null, planId: null });
});

test("approval link prefers payer-action, falls back to approve", () => {
  assert.equal(approvalLink({ links: [{ rel: "self", href: "a" }, { rel: "approve", href: "b" }] }), "b");
  assert.equal(approvalLink({ links: [{ rel: "approve", href: "b" }, { rel: "payer-action", href: "c" }] }), "c");
  assert.equal(approvalLink({}), null);
});

test("normaliseOrder reads the capture", () => {
  const order = {
    id: "ORD1",
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: "user_1|pro",
        amount: { currency_code: "USD", value: "20.00" },
        payments: { captures: [{ id: "CAP1", status: "COMPLETED", custom_id: "user_1|pro", amount: { currency_code: "USD", value: "20.00" } }] },
      },
    ],
  };
  assert.deepEqual(normaliseOrder(order), { orderId: "ORD1", status: "COMPLETED", captureId: "CAP1", amountCents: 2000, currency: "USD", userId: "user_1", planId: "pro" });
});

test("webhook parsing keeps only completed captures", () => {
  const ev = {
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: { id: "CAP9", status: "COMPLETED", custom_id: "user_2|starter", amount: { value: "5.00", currency_code: "USD" }, supplementary_data: { related_ids: { order_id: "ORD9" } } },
  };
  assert.deepEqual(parseWebhookEvent(ev), { orderId: "ORD9", status: "COMPLETED", captureId: "CAP9", amountCents: 500, currency: "USD", userId: "user_2", planId: "starter" });
  assert.equal(parseWebhookEvent({ event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }), null);
  assert.equal(parseWebhookEvent({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { status: "PENDING" } }), null);
});
