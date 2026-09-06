import { NextResponse } from "next/server";
import config from "@/lib/config";
import { capturePayPalOrder } from "@/lib/billing/paypal";
import { BillingService } from "@/lib/services/billing";

// PayPal sends the buyer back here after approval: ?token=ORDER_ID&PayerID=…  Approval is not
// payment — the capture call below is what actually moves the money.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("token");
  const back = (q) => NextResponse.redirect(`${config.auth.url}/pricing?${q}`);
  if (!orderId) return back("error=missing_order");

  try {
    const captured = await capturePayPalOrder(orderId);
    if (captured.status !== "COMPLETED") return back(`error=${encodeURIComponent(captured.status || "not_completed")}`);

    await BillingService.grantCredits({
      provider: "paypal",
      providerOrderId: orderId,
      checkoutId: captured.captureId,
      userId: captured.userId,
      planId: captured.planId,
      amountCents: captured.amountCents,
      currency: captured.currency,
    });
    return back("success=true&provider=paypal");
  } catch (error) {
    console.error("PayPal return/capture error:", error);
    return back(`error=${encodeURIComponent(error.message.slice(0, 120))}`);
  }
}
