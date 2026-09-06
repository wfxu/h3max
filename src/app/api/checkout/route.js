import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { BillingService, configuredPaymentProviders, PROVIDER_LABELS } from "@/lib/services/billing";

/** Which payment buttons to show. */
export async function GET() {
  const providers = configuredPaymentProviders().map((id) => ({ id, label: PROVIDER_LABELS[id] || id }));
  return NextResponse.json({ providers });
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to buy credits." }, { status: 401 });
    }

    const { planId, provider } = await req.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    const result = await BillingService.createCheckoutSession(session.user, planId, provider);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Checkout error:", error);
    const status = /not configured/i.test(error.message || "") ? 503 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
