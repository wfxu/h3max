import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing";

export async function POST(req) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }
    const result = await BillingService.handleStripeWebhook(body, signature);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
