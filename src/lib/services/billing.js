// Credit purchases. Several providers can be live at once (PayPal, Creem, Stripe); the buyer picks
// one on /pricing. Every path ends in `grantCredits`, which is idempotent on the provider's order id.
import { prisma } from "../prisma";
import config from "../config";
import { createCreemCheckout, creemConfigured } from "../billing/creem";
import { createPayPalOrder, paypalConfigured } from "../billing/paypal";

function stripeConfigured() {
  const key = config.stripe.secretKey;
  return typeof key === "string" && key.startsWith("sk_") && !/placeholder/i.test(key);
}

export const PROVIDER_LABELS = {
  paypal: "PayPal",
  creem: "Card (Creem)",
  stripe: "Card (Stripe)",
};

/** Providers that have credentials, in display order. PAYMENT_PROVIDERS can pin/limit the list. */
export function configuredPaymentProviders() {
  const available = [];
  if (paypalConfigured()) available.push("paypal");
  if (creemConfigured()) available.push("creem");
  if (stripeConfigured()) available.push("stripe");

  const wanted = (config.payments.provider || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return available;
  return wanted.filter((p) => available.includes(p));
}

export function activePaymentProvider() {
  return configuredPaymentProviders()[0] || null;
}

export const BillingService = {
  providers: configuredPaymentProviders,
  provider: activePaymentProvider,

  /** Returns { url, provider } for the hosted checkout page of the given plan. */
  async createCheckoutSession(user, planId, providerHint) {
    const plan = config.plans[planId];
    if (!plan) throw new Error("Invalid plan selected");
    const providers = configuredPaymentProviders();
    const provider = providerHint && providers.includes(providerHint) ? providerHint : providers[0];
    if (!provider) throw new Error("Payments are not configured yet");

    const successUrl = `${config.auth.url}/pricing?success=true`;
    const cancelUrl = `${config.auth.url}/pricing?canceled=true`;

    if (provider === "paypal") {
      const requestId = `h3max-${user.id}-${plan.id}-${Date.now().toString(36)}`;
      const { orderId, url } = await createPayPalOrder({
        user,
        plan,
        requestId,
        returnUrl: `${config.auth.url}/api/paypal/return`,
        cancelUrl,
      });
      await this.recordPendingOrder({ provider, providerOrderId: orderId, userId: user.id, planId: plan.id, credits: plan.credits, amountCents: plan.price, currency: "USD" });
      return { url, provider };
    }

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

  /** Remember an order before the buyer leaves, so capture/webhook can verify amount and owner. */
  async recordPendingOrder({ provider, providerOrderId, userId, planId, credits, amountCents, currency }) {
    return prisma.payment.upsert({
      where: { providerOrderId },
      update: {},
      create: { provider, providerOrderId, userId, planId, credits, amountCents, currency, status: "created" },
    });
  },

  /**
   * Record a paid order and add its credits — exactly once per providerOrderId.
   * Works both for orders we pre-recorded (status "created") and for providers that only webhook us.
   */
  async grantCredits({ provider, providerOrderId, checkoutId, userId, planId, credits, amountCents, currency }) {
    if (!providerOrderId) throw new Error("Missing provider order id");

    const existing = await prisma.payment.findUnique({ where: { providerOrderId } });
    if (existing?.status === "paid") return { granted: false, duplicate: true, paymentId: existing.id };

    const resolvedUserId = existing?.userId || userId;
    const resolvedPlanId = existing?.planId || planId || null;
    const plan = resolvedPlanId ? config.plans[resolvedPlanId] : null;
    const amount = existing?.credits || (Number(credits) > 0 ? Number(credits) : plan?.credits || 0);
    if (!resolvedUserId || amount <= 0) throw new Error(`Cannot grant credits: userId=${resolvedUserId} credits=${amount}`);

    // Amount check: what the provider says was paid must match the pack's price.
    const expectedCents = existing?.amountCents ?? plan?.price ?? null;
    if (expectedCents !== null && amountCents !== null && amountCents !== undefined && Number(amountCents) < expectedCents) {
      throw new Error(`Paid amount ${amountCents} is below the plan price ${expectedCents}`);
    }

    const user = await prisma.user.findUnique({ where: { id: resolvedUserId }, select: { id: true } });
    if (!user) throw new Error(`Unknown user ${resolvedUserId}`);

    const payment = await prisma.$transaction(async (tx) => {
      const data = {
        provider,
        providerOrderId,
        checkoutId: checkoutId || existing?.checkoutId || null,
        userId: resolvedUserId,
        planId: resolvedPlanId,
        credits: amount,
        amountCents: amountCents ?? existing?.amountCents ?? null,
        currency: currency || existing?.currency || null,
        status: "paid",
      };
      const row = existing
        ? await tx.payment.update({ where: { id: existing.id }, data })
        : await tx.payment.create({ data });
      await tx.user.update({ where: { id: resolvedUserId }, data: { credits: { increment: amount } } });
      return row;
    });
    return { granted: true, duplicate: false, paymentId: payment.id, credits: amount };
  },

  /** Stripe webhook (only when Stripe is configured). */
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
