import { NextResponse } from "next/server";
import { verifyCreemSignature, parseCreemEvent } from "@/lib/billing/creem";
import { BillingService } from "@/lib/services/billing";

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("creem-signature");
    if (!verifyCreemSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = parseCreemEvent(payload);
    if (!event) return NextResponse.json({ ok: true, ignored: payload?.eventType || "unknown" });

    const result = await BillingService.grantCredits(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Creem webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
