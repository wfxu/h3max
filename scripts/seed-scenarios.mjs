// Seeds the starter set of Studio scenarios. Safe to re-run: existing slugs are updated, not duplicated.
// Usage: node scripts/seed-scenarios.mjs   (needs DATABASE_URL and ADMIN_EMAILS in .env)
import "dotenv/config";
import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase();
if (!ownerEmail) {
  console.error("ADMIN_EMAILS is empty — the seed needs an owner account.");
  process.exit(1);
}

// Pricing: 1 credit = $0.01, ~1.5× fal.ai list price. H3 Max 768P = 12 credits/s, Turbo 768P = 6/s, Turbo 480P = 4/s.
const SCENARIOS = [
  {
    slug: "photo-to-life",
    name: "Bring a Photo to Life",
    description: "Upload any photo — a portrait, a pet, a landscape — and H3 Max animates it with natural, subtle motion. Optional: tell it what should move.",
    sortOrder: 10,
    config: {
      modelEndpoint: "minimax/h3-max/image-to-video",
      systemPrompt: "Animate this photo with subtle, natural, realistic motion. Keep the subject's identity, the original framing and lighting. Gentle camera drift.",
      promptLabel: "What should move? (optional)",
      promptPlaceholder: "e.g. she smiles and the wind moves her hair",
      showPrompt: true,
      requireImage: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "slate-indigo",
      userParams: [],
    },
  },
  {
    slug: "product-showcase",
    name: "Product Showcase",
    description: "Turn one product photo into a 5-second commercial shot: slow orbit, studio lighting, premium feel. Made for shop pages and ads.",
    sortOrder: 20,
    config: {
      modelEndpoint: "minimax/h3-max/image-to-video",
      systemPrompt: "Cinematic product commercial: the camera slowly orbits the product, soft studio lighting with gentle highlights, clean background, premium advertising look, no text.",
      promptLabel: "Anything specific? (optional)",
      promptPlaceholder: "e.g. light reflections on the glass, warm tone",
      showPrompt: true,
      requireImage: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "midnight",
      userParams: [],
    },
  },
  {
    slug: "vertical-social-clip",
    name: "Vertical Social Clip",
    description: "A 9:16 clip for TikTok, Reels and Shorts from a single sentence. Energetic pacing, vivid colors, fast on H3 Max Turbo.",
    sortOrder: 30,
    config: {
      modelEndpoint: "minimax/h3-max-turbo/text-to-video",
      systemPrompt: "Vertical short-form social video, energetic pacing, vibrant saturated colors, punchy camera movement, trending aesthetic.",
      promptLabel: "Describe the clip",
      promptPlaceholder: "e.g. a barista pouring latte art in a sunlit café",
      showPrompt: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "9:16",
      creditCost: 30,
      theme: "cyberpunk",
      userParams: [],
    },
  },
  {
    slug: "cinematic-text-to-video",
    name: "Cinematic Text to Video",
    description: "Full-quality H3 Max at 768P, 16:9, 5 to 15 seconds. Film-grade lighting and camera work from your description.",
    sortOrder: 40,
    config: {
      modelEndpoint: "minimax/h3-max/text-to-video",
      systemPrompt: "Cinematic film still brought to life: film-grade lighting, shallow depth of field, deliberate camera movement, rich color grading.",
      promptLabel: "Describe the scene",
      promptPlaceholder: "e.g. a lighthouse keeper watches a storm roll in at dusk",
      showPrompt: true,
      duration: "",
      resolution: "768P",
      aspectRatio: "16:9",
      creditCost: 0,
      theme: "slate-indigo",
      userParams: [
        { key: "duration", label: "Length", type: "slider", defaultValue: 5, min: 5, max: 15, step: 1, costPerUnit: 12 },
      ],
    },
  },
  {
    slug: "character-reference",
    name: "Consistent Character",
    description: "Upload 1–3 reference images of a character and describe the shot. H3 Max keeps the look consistent across your clips.",
    sortOrder: 50,
    config: {
      modelEndpoint: "minimax/h3-max/reference-to-video",
      systemPrompt: "Keep the character's face, hairstyle, outfit and proportions exactly consistent with the reference images.",
      promptLabel: "Describe the shot",
      promptPlaceholder: "e.g. Image 1 walks through a neon night market, medium shot",
      showPrompt: true,
      duration: 5,
      resolution: "768P",
      aspectRatio: "16:9",
      creditCost: 60,
      theme: "sunset",
      userParams: [
        { key: "reference_image_urls", label: "Character references", type: "image_list", defaultValue: [], maxInputs: 3, help: "Refer to them in your text as Image 1, Image 2…" },
      ],
    },
  },
  {
    slug: "quick-draft",
    name: "Quick Draft",
    description: "The cheapest way to test an idea: H3 Max Turbo at 480P, 5 seconds, 16:9. Iterate on the prompt here, then upgrade.",
    sortOrder: 60,
    config: {
      modelEndpoint: "minimax/h3-max-turbo/text-to-video",
      systemPrompt: "",
      promptLabel: "Describe the clip",
      promptPlaceholder: "Anything — this is the sandbox",
      showPrompt: true,
      duration: 5,
      resolution: "480P",
      aspectRatio: "16:9",
      creditCost: 20,
      theme: "emerald",
      userParams: [],
    },
  },
];

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail, name: "Operator", credits: 1000 },
  });

  for (const s of SCENARIOS) {
    const data = {
      name: s.name,
      description: s.description,
      sortOrder: s.sortOrder,
      isPublic: true,
      templateId: "ai-video",
      config: JSON.stringify(s.config),
      userId: owner.id,
    };
    await prisma.appInstance.upsert({ where: { slug: s.slug }, update: data, create: { ...data, slug: s.slug } });
    console.log(`✔ ${s.slug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
