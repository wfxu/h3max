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
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // 1 credit = $0.01 of generation. Larger packs carry a bonus.
    plans: {
      starter: { id: "starter", name: "Starter Pack", credits: 500, price: 500 },
      creator: { id: "creator", name: "Creator Pack", credits: 1100, price: 1000 },
      pro: { id: "pro", name: "Pro Pack", credits: 2400, price: 2000 },
      studio: { id: "studio", name: "Studio Pack", credits: 6500, price: 5000 },
    },
  },
  ai: {
    falKey: process.env.FAL_KEY,
    generationCost: 60, // fallback cost when an app has no creditCost configured
  },
};

export default config;
