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
import { SCENARIOS } from "../src/lib/scenarios.js";

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
