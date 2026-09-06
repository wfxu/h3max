import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { BillingService } from "@/lib/services/billing";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to buy credits." }, { status: 401 });
    }

    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    const { url, provider } = await BillingService.createCheckoutSession(session.user, planId);
    return NextResponse.json({ url, provider });
  } catch (error) {
    console.error("Checkout error:", error);
    const status = /not configured/i.test(error.message || "") ? 503 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
