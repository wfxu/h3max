const config = {
  appName: "H3 Max Studio",
  siteUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    webhook_url: process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
  // 1 credit = $0.01 of generation. Larger packs carry a bonus. Prices in USD cents.
  // Creem needs one product per pack (created in the Creem dashboard); Stripe uses ad-hoc price_data.
  plans: {
    starter: { id: "starter", name: "Starter Pack", credits: 500, price: 500, creemProductId: process.env.CREEM_PRODUCT_STARTER },
    creator: { id: "creator", name: "Creator Pack", credits: 1100, price: 1000, creemProductId: process.env.CREEM_PRODUCT_CREATOR },
    pro: { id: "pro", name: "Pro Pack", credits: 2400, price: 2000, creemProductId: process.env.CREEM_PRODUCT_PRO },
    studio: { id: "studio", name: "Studio Pack", credits: 6500, price: 5000, creemProductId: process.env.CREEM_PRODUCT_STUDIO },
  },
  payments: {
    // Comma-separated list to show, in order (e.g. "paypal,creem"). Empty = every configured provider.
    provider: process.env.PAYMENT_PROVIDERS || process.env.PAYMENT_PROVIDER || "",
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      env: (process.env.PAYPAL_ENV || "sandbox").toLowerCase() === "live" ? "live" : "sandbox",
      webhookId: process.env.PAYPAL_WEBHOOK_ID,
    },
    creem: {
      apiKey: process.env.CREEM_API_KEY,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      // Test keys (creem_test_…) must go to test-api.creem.io; production keys to api.creem.io.
      apiBase: process.env.CREEM_API_BASE || ((process.env.CREEM_API_KEY || "").startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io"),
    },
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  ai: {
    falKey: process.env.FAL_KEY,
    generationCost: 60, // fallback cost when an app has no creditCost configured
  },
};

export default config;
