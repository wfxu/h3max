import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { AIService } from "@/lib/services/ai";
import { computeCost } from "@/lib/cost";
import { resolveParams, buildPrompt, safeParseConfig, isUrlLike } from "@/lib/params";
import { DEFAULT_MODEL_ID, getModel, isKnownModel } from "@/lib/models";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to generate videos." }, { status: 401 });
    }

    const body = (await req.json()) || {};
    const { appId, prompt = "", inputImage = null } = body;
    if (!appId) return NextResponse.json({ error: "Missing appId" }, { status: 400 });

    const app = await prisma.appInstance.findUnique({ where: { id: appId } });
    const admin = isAdminEmail(session.user.email);
    if (!app || (!app.isPublic && !admin)) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const cfg = safeParseConfig(app.config);
    const modelId = isKnownModel(cfg.modelEndpoint) ? cfg.modelEndpoint : DEFAULT_MODEL_ID;
    const model = getModel(modelId);

    const { values, input } = resolveParams(cfg, body, modelId);
    const finalPrompt = buildPrompt(cfg, prompt, values);
    if (!finalPrompt) {
      return NextResponse.json({ error: "Please describe the video you want." }, { status: 400 });
    }
    // Params the template needs (e.g. the text to write) must not be empty.
    for (const p of Array.isArray(cfg.userParams) ? cfg.userParams : []) {
      if (p?.required && (values[p.key] === undefined || values[p.key] === "" || (Array.isArray(values[p.key]) && !values[p.key].length))) {
        return NextResponse.json({ error: `Please fill in "${p.label || p.key}".` }, { status: 400 });
      }
    }

    // Default-form image upload → the right key for the model's mode.
    if (isUrlLike(inputImage)) {
      if (model.mode === "i2v" && !input.image_url) input.image_url = inputImage;
      if (model.mode === "r2v" && !input.reference_image_urls) input.reference_image_urls = [inputImage];
    }
    if (model.mode === "i2v" && !input.image_url && cfg.requireImage) {
      return NextResponse.json({ error: "Please upload an image first." }, { status: 400 });
    }

    const cost = computeCost(cfg, values);
    const result = await AIService.generate(session.user.id, {
      appId: app.id,
      modelId,
      prompt: finalPrompt,
      userPrompt: String(prompt || "").slice(0, 5000),
      inputImage: input.image_url || input.reference_image_urls?.[0] || null,
      input,
      cost,
    });

    return NextResponse.json({ ...result, cost });
  } catch (error) {
    console.error("Generation error:", error);
    const status = /insufficient credits/i.test(error.message || "") ? 402 : 500;
    return NextResponse.json({ error: error.message || "Generation failed" }, { status });
  }
}
