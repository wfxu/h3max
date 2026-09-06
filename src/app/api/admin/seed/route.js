import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { SCENARIOS } from "@/lib/scenarios";

// One-shot production seeding for operators: upserts the starter scenarios (hidden by default so
// nothing untested goes public). Safe to call again — existing slugs are updated, not duplicated.
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) || {};
    const publish = Array.isArray(body.publish) ? body.publish : ["profile-takeover", "quick-draft"];

    const results = [];
    for (const s of SCENARIOS) {
      const data = {
        name: s.name,
        description: s.description,
        sortOrder: s.sortOrder,
        isPublic: publish.includes(s.slug),
        templateId: "ai-video",
        config: JSON.stringify(s.config),
        userId: session.user.id,
      };
      const row = await prisma.appInstance.upsert({ where: { slug: s.slug }, update: data, create: { ...data, slug: s.slug } });
      results.push({ slug: row.slug, isPublic: row.isPublic });
    }
    return NextResponse.json({ ok: true, seeded: results });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
