import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { safeParseConfig, isUrlLike } from "@/lib/params";
import { describeImage } from "@/lib/vision";

// Cheap but not free: cap analyses per user per hour (per server instance).
const LIMIT_PER_HOUR = 40;
const buckets = new Map();
function allow(userId) {
  const now = Date.now();
  const list = (buckets.get(userId) || []).filter((t) => now - t < 3600_000);
  if (list.length >= LIMIT_PER_HOUR) return false;
  list.push(now);
  buckets.set(userId, list);
  return true;
}

/** POST { appId, paramKey, imageUrl } → { text } for a param configured with autofill = "vision". */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const { appId, paramKey, imageUrl } = (await req.json()) || {};
    if (!appId || !paramKey || !isUrlLike(imageUrl)) {
      return NextResponse.json({ error: "Missing appId, paramKey or a valid imageUrl" }, { status: 400 });
    }

    const app = await prisma.appInstance.findUnique({ where: { id: appId } });
    if (!app || (!app.isPublic && !isAdminEmail(session.user.email))) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const cfg = safeParseConfig(app.config);
    const param = (cfg.userParams || []).find((p) => p?.key === paramKey && p.autofill === "vision");
    if (!param || !param.autofillInstruction) {
      return NextResponse.json({ error: "This field is not configured for image analysis" }, { status: 400 });
    }

    if (!allow(session.user.id)) {
      return NextResponse.json({ error: "Too many analyses — please try again in a while." }, { status: 429 });
    }

    const result = await describeImage({ imageUrl, instruction: param.autofillInstruction, model: cfg.visionModel });
    return NextResponse.json({ text: result.text, mock: result.mock });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}
