// Credit purchases. One provider is active at a time (Creem by default, Stripe optional); both end
// in `grantCredits`, which is idempotent on the provider's order id so webhook retries are safe.
import { prisma } from "../prisma";
import config from "../config";
import { createCreemCheckout, creemConfigured } from "../billing/creem";

function stripeConfigured() {
  const key = config.stripe.secretKey;
  return typeof key === "string" && key.startsWith("sk_") && !/placeholder/i.test(key);
}

export function activePaymentProvider() {
  const forced = (config.payments.provider || "").toLowerCase();
  if (forced === "creem") return creemConfigured() ? "creem" : null;
  if (forced === "stripe") return stripeConfigured() ? "stripe" : null;
  if (creemConfigured()) return "creem";
  if (stripeConfigured()) return "stripe";
  return null;
}

export const BillingService = {
  provider: activePaymentProvider,

  /** Returns { url } for the hosted checkout page of the given plan. */
  async createCheckoutSession(user, planId) {
    const plan = config.plans[planId];
    if (!plan) throw new Error("Invalid plan selected");
    const provider = activePaymentProvider();
    if (!provider) throw new Error("Payments are not configured yet");

    const successUrl = `${config.auth.url}/pricing?success=true`;
    const cancelUrl = `${config.auth.url}/pricing?canceled=true`;

    if (provider === "creem") {
      const requestId = `h3max-${user.id}-${plan.id}-${Date.now().toString(36)}`;
      const { url } = await createCreemCheckout({ user, plan, requestId, successUrl });
      return { url, provider };
    }

    const { stripe } = await import("../stripe");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name, description: `${plan.credits} credits for H3 Max Studio.` },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: user.email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, planId: plan.id, credits: String(plan.credits) },
    });
    return { url: session.url, provider };
  },

  /**
   * Record a paid order and add its credits — exactly once per providerOrderId.
   * Falls back to the plan's credit amount when the provider did not echo `credits` back.
   */
  async grantCredits({ provider, providerOrderId, checkoutId, userId, planId, credits, amountCents, currency }) {
    if (!providerOrderId) throw new Error("Missing provider order id");
    const plan = planId ? config.plans[planId] : null;
    const amount = Number(credits) > 0 ? Number(credits) : plan?.credits || 0;
    if (!userId || amount <= 0) throw new Error(`Cannot grant credits: userId=${userId} credits=${amount}`);

    const existing = await prisma.payment.findUnique({ where: { providerOrderId } });
    if (existing) return { granted: false, duplicate: true, paymentId: existing.id };

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new Error(`Unknown user ${userId}`);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: { provider, providerOrderId, checkoutId: checkoutId || null, userId, planId: planId || null, credits: amount, amountCents: amountCents ?? null, currency: currency || null },
      });
      await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
      return created;
    });
    return { granted: true, duplicate: false, paymentId: payment.id, credits: amount };
  },

  /** Stripe webhook (only when PAYMENT_PROVIDER=stripe). */
  async handleStripeWebhook(body, signature) {
    const { stripe } = await import("../stripe");
    const event = stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
    if (event.type !== "checkout.session.completed") return { success: false, ignored: event.type };
    const session = event.data.object;
    if (session.payment_status && session.payment_status !== "paid") return { success: false, ignored: session.payment_status };
    const result = await this.grantCredits({
      provider: "stripe",
      providerOrderId: session.id,
      checkoutId: session.id,
      userId: session.metadata?.userId,
      planId: session.metadata?.planId,
      credits: Number(session.metadata?.credits || 0),
      amountCents: session.amount_total ?? null,
      currency: session.currency ? session.currency.toUpperCase() : null,
    });
    return { success: true, ...result };
  },
};

export default BillingService;
