import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

    const where = { userId: session.user.id };
    if (appId) where.appId = appId;

    const creations = await prisma.creation.findMany({
      where,
      include: { app: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Heal any in-flight jobs whose webhook never reached us (e.g. local development).
    const synced = await Promise.all(
      creations.map(async (c) => {
        if (c.status !== "processing") return c;
        const updated = await AIService.syncStatus(c.id);
        return { ...c, ...updated };
      })
    );

    return NextResponse.json(synced);
  } catch (error) {
    console.error("Creations GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
