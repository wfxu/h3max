// Generation service on top of fal.ai's queue API. Without a FAL_KEY the service runs in
// mock mode and returns a sample clip so the UI can be exercised locally without spending money.
import { prisma } from "../prisma";
import { UserService } from "./user";
import config from "../config";
import { getFal, hasFalKey } from "../fal";

// Served from public/mock/ (git-ignored) so it also loads where Google-hosted samples are blocked.
const mockVideoUrl = () => process.env.MOCK_VIDEO_URL || `${config.siteUrl}/mock/sample.mp4`;

function extractVideoUrl(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.video && typeof payload.video === "object" && payload.video.url) return payload.video.url;
  if (typeof payload.video_url === "string") return payload.video_url;
  if (Array.isArray(payload.outputs) && typeof payload.outputs[0] === "string") return payload.outputs[0];
  return null;
}

function errorMessage(err) {
  const detail = err?.body?.detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  if (typeof detail === "string") return detail;
  return err?.message || "Generation failed";
}

export const AIService = {
  isMock() {
    return !hasFalKey();
  },

  /**
   * Charge the user, record the creation and enqueue the job on fal.ai.
   * `input` must already be whitelisted (see lib/params.js).
   */
  async generate(userId, { appId, modelId, prompt, userPrompt, inputImage, input, cost }) {
    await UserService.deductCredits(userId, cost);

    const creation = await prisma.creation.create({
      data: {
        userId,
        appId: appId || null,
        prompt: userPrompt ?? prompt,
        inputImage: inputImage || null,
        aspectRatio: input.aspect_ratio || null,
        resolution: input.resolution || null,
        duration: input.duration !== undefined ? Number(input.duration) : null,
        modelId,
        creditCost: cost,
        status: "processing",
      },
    });

    if (this.isMock()) {
      const done = await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "completed", resultImage: mockVideoUrl(), requestId: `mock_${creation.id}` },
      });
      return { id: done.id, status: done.status, resultImage: done.resultImage, mock: true };
    }

    try {
      const webhookUrl = `${config.auth.webhook_url}/api/webhook/fal`;
      // Keep generated files on the fal CDN indefinitely (default retention is not guaranteed).
      const headers = { "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: null }) };
      const queued = await getFal().queue.submit(modelId, { input: { ...input, prompt }, webhookUrl, headers });
      await prisma.creation.update({ where: { id: creation.id }, data: { requestId: queued.request_id } });
      return { id: creation.id, status: "processing", requestId: queued.request_id };
    } catch (err) {
      await this.fail(creation, `Submission failed: ${errorMessage(err)}`);
      throw new Error(errorMessage(err));
    }
  },

  /** Poll fal for a processing creation (used when the webhook cannot reach us, e.g. locally). */
  async syncStatus(creationId) {
    const creation = await prisma.creation.findUnique({ where: { id: creationId } });
    if (!creation || creation.status !== "processing") return creation;
    if (!creation.requestId || !creation.modelId || this.isMock()) return creation;

    const fal = getFal();
    let status;
    try {
      status = await fal.queue.status(creation.modelId, { requestId: creation.requestId });
    } catch (err) {
      // 4xx means fal no longer knows the request (expired/invalid); network errors keep it processing.
      if (err?.status >= 400 && err.status < 500) return this.fail(creation, errorMessage(err));
      return creation;
    }
    if (status.status !== "COMPLETED") return creation;

    try {
      const { data } = await fal.queue.result(creation.modelId, { requestId: creation.requestId });
      return this.complete(creation, data);
    } catch (err) {
      if (err?.status >= 400 && err.status < 500) return this.fail(creation, errorMessage(err));
      return creation;
    }
  },

  async complete(creation, payload) {
    if (creation.status !== "processing") return creation;
    const url = extractVideoUrl(payload);
    if (!url) return this.fail(creation, "No video URL in fal.ai result");
    return prisma.creation.update({
      where: { id: creation.id },
      data: { status: "completed", resultImage: url, error: null },
    });
  },

  async fail(creation, message) {
    if (creation.status !== "processing") return creation;
    const updated = await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "failed", error: String(message || "Generation failed").slice(0, 2000) },
    });
    await UserService.addCredits(creation.userId, creation.creditCost);
    return updated;
  },
};

export default AIService;
