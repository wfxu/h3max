import { NextResponse } from "next/server";
import { verifyPayPalWebhook, parseWebhookEvent } from "@/lib/billing/paypal";
import { BillingService } from "@/lib/services/billing";

// Backstop for buyers who never reach /api/paypal/return. Idempotent with the return path.
export async function POST(req) {
  try {
    const rawBody = await req.text();
    const valid = await verifyPayPalWebhook(req.headers, rawBody);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const payload = JSON.parse(rawBody);
    const event = parseWebhookEvent(payload);
    if (!event) return NextResponse.json({ ok: true, ignored: payload?.event_type || "unknown" });

    const result = await BillingService.grantCredits({
      provider: "paypal",
      providerOrderId: event.orderId,
      checkoutId: event.captureId,
      userId: event.userId,
      planId: event.planId,
      amountCents: event.amountCents,
      currency: event.currency,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
