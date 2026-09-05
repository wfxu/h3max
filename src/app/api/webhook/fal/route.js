import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/lib/services/ai";
import { verifyFalWebhook } from "@/lib/fal-webhook";

// fal.ai retries on non-2xx (up to 31 times with backoff), so answer 2xx once a request is handled.
export async function POST(req) {
  try {
    const rawBody = await req.text();

    const skipVerify = process.env.NODE_ENV !== "production" && process.env.FAL_WEBHOOK_SKIP_VERIFY === "1";
    if (!skipVerify) {
      const valid = await verifyFalWebhook(req.headers, rawBody);
      if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const requestId = data.request_id;
    if (!requestId) return NextResponse.json({ error: "Missing request_id" }, { status: 400 });

    const creation = await prisma.creation.findFirst({ where: { requestId } });
    if (!creation) return NextResponse.json({ error: "Unknown request" }, { status: 404 });
    if (creation.status !== "processing") return NextResponse.json({ ok: true, status: creation.status });

    if (data.status === "ERROR" || data.payload_error) {
      const detail = data.payload?.detail;
      const message =
        data.error ||
        data.payload_error ||
        (Array.isArray(detail) ? detail.map((d) => d.msg).join("; ") : "Generation failed");
      const failed = await AIService.fail(creation, message);
      return NextResponse.json({ ok: true, status: failed.status });
    }

    const done = await AIService.complete(creation, data.payload);
    return NextResponse.json({ ok: true, status: done.status });
  } catch (error) {
    console.error("fal webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
