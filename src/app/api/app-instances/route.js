import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { slugify, isValidSlug } from "@/lib/slug";
import { DEFAULT_MODEL_ID, isKnownModel, clampDuration, normalizeResolution, ASPECT_RATIOS } from "@/lib/models";

const PARAM_TYPES = ["text", "textarea", "number", "boolean", "enum", "slider", "image_list", "video_list", "audio_list", "hidden"];
const THEMES = ["slate-indigo", "cyberpunk", "emerald", "sunset", "midnight"];

async function currentAdmin() {
  const session = await getServerSession(authOptions);
  const admin = !!session?.user && isAdminEmail(session.user.email);
  return { session, admin };
}

/** Keep only fields the app understands; everything is stored as a JSON string. */
function sanitizeConfig(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const params = Array.isArray(c.userParams) ? c.userParams : [];
  const userParams = params
    .filter((p) => p && typeof p.key === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(p.key))
    .map((p) => ({
      key: p.key,
      label: String(p.label || p.key).slice(0, 80),
      type: PARAM_TYPES.includes(p.type) ? p.type : "text",
      defaultValue: p.defaultValue,
      options: Array.isArray(p.options) ? p.options.map(String).slice(0, 50) : undefined,
      costModifiers: Array.isArray(p.costModifiers) ? p.costModifiers.map((n) => Number(n) || 0) : undefined,
      costPerUnit: p.costPerUnit !== undefined ? Number(p.costPerUnit) || 0 : undefined,
      costIfTrue: p.costIfTrue !== undefined ? Number(p.costIfTrue) || 0 : undefined,
      min: p.min !== undefined && p.min !== "" && p.min !== null ? Number(p.min) : undefined,
      max: p.max !== undefined && p.max !== "" && p.max !== null ? Number(p.max) : undefined,
      step: p.step !== undefined && p.step !== "" && p.step !== null ? Number(p.step) : undefined,
      maxInputs: p.maxInputs !== undefined ? Math.max(1, Math.min(12, Number(p.maxInputs) || 1)) : undefined,
      placeholder: p.placeholder ? String(p.placeholder).slice(0, 200) : undefined,
      help: p.help ? String(p.help).slice(0, 300) : undefined,
    }));

  return {
    modelEndpoint: isKnownModel(c.modelEndpoint) ? c.modelEndpoint : DEFAULT_MODEL_ID,
    systemPrompt: String(c.systemPrompt || "").slice(0, 5000),
    promptTemplate: c.promptTemplate ? String(c.promptTemplate).slice(0, 5000) : "",
    promptLabel: c.promptLabel ? String(c.promptLabel).slice(0, 80) : "",
    promptPlaceholder: c.promptPlaceholder ? String(c.promptPlaceholder).slice(0, 200) : "",
    duration: c.duration === "" || c.duration === undefined || c.duration === null ? "" : clampDuration(c.duration),
    resolution: c.resolution ? normalizeResolution(c.resolution) : "768P",
    aspectRatio: ASPECT_RATIOS.includes(c.aspectRatio) ? c.aspectRatio : "",
    creditCost: Math.max(0, Math.round(Number(c.creditCost) || 0)),
    theme: THEMES.includes(c.theme) ? c.theme : "slate-indigo",
    showPrompt: c.showPrompt !== false,
    requireImage: c.requireImage === true,
    userParams,
  };
}

async function uniqueSlug(base, excludeId) {
  const slug = slugify(base) || `tool-${Date.now().toString(36)}`;
  let candidate = slug;
  for (let i = 2; i < 50; i += 1) {
    const clash = await prisma.appInstance.findUnique({ where: { slug: candidate } });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${slug}-${i}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function pickFields(body) {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim().slice(0, 80);
  if (body.description !== undefined) out.description = String(body.description || "").slice(0, 600);
  if (body.coverImage !== undefined) out.coverImage = String(body.coverImage || "").slice(0, 2000) || null;
  if (body.isPublic !== undefined) out.isPublic = Boolean(body.isPublic);
  if (body.sortOrder !== undefined) out.sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : 0;
  if (body.config !== undefined) out.config = JSON.stringify(sanitizeConfig(body.config));
  return out;
}

export async function GET(req) {
  try {
    const { admin } = await currentAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const slug = searchParams.get("slug");

    if (id || slug) {
      const instance = await prisma.appInstance.findFirst({ where: id ? { id } : { slug } });
      if (!instance || (!instance.isPublic && !admin)) {
        return NextResponse.json({ error: "Tool not found" }, { status: 404 });
      }
      return NextResponse.json(instance);
    }

    const where = admin && searchParams.get("all") === "1" ? {} : { isPublic: true };
    const instances = await prisma.appInstance.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(instances);
  } catch (error) {
    console.error("AppInstances GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { session, admin } = await currentAdmin();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const fields = pickFields(body);
    if (!fields.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (fields.config === undefined) fields.config = JSON.stringify(sanitizeConfig({}));

    const requestedSlug = body.slug ? slugify(body.slug) : "";
    if (body.slug && !isValidSlug(requestedSlug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const instance = await prisma.appInstance.create({
      data: {
        ...fields,
        slug: await uniqueSlug(requestedSlug || fields.name),
        templateId: "ai-video",
        userId: session.user.id,
      },
    });
    return NextResponse.json(instance);
  } catch (error) {
    console.error("AppInstances POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { session, admin } = await currentAdmin();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const existing = await prisma.appInstance.findUnique({ where: { id: body.id } });
    if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

    const fields = pickFields(body);
    if (fields.name !== undefined && !fields.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (body.slug !== undefined) {
      const requested = slugify(body.slug);
      if (!isValidSlug(requested)) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      fields.slug = await uniqueSlug(requested, existing.id);
    }

    const instance = await prisma.appInstance.update({ where: { id: existing.id }, data: fields });
    return NextResponse.json(instance);
  } catch (error) {
    console.error("AppInstances PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { session, admin } = await currentAdmin();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const instance = await prisma.appInstance.findUnique({ where: { id } });
    if (!instance) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

    await prisma.appInstance.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AppInstances DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
