// MiniMax H3 Max endpoints on fal.ai (the ones listed on h3max.info). Shared by server and client.
export const CREDIT_USD = 0.01; // 1 credit = $0.01
export const PRICE_MARKUP = 1.5; // suggested sell price = fal cost × markup

export const H3_MODELS = [
  { id: "minimax/h3-max/text-to-video", label: "H3 Max · Text to Video", family: "H3 Max", mode: "t2v", usdPerSecond: { "480P": 0.05, "768P": 0.08 } },
  { id: "minimax/h3-max/image-to-video", label: "H3 Max · Image to Video", family: "H3 Max", mode: "i2v", usdPerSecond: { "480P": 0.05, "768P": 0.08 } },
  { id: "minimax/h3-max/reference-to-video", label: "H3 Max · Reference to Video", family: "H3 Max", mode: "r2v", usdPerSecond: { "480P": 0.05, "768P": 0.08 } },
  { id: "minimax/h3-max-turbo/text-to-video", label: "H3 Max Turbo · Text to Video", family: "H3 Max Turbo", mode: "t2v", usdPerSecond: { "480P": 0.025, "768P": 0.04 } },
  { id: "minimax/h3-max-turbo/image-to-video", label: "H3 Max Turbo · Image to Video", family: "H3 Max Turbo", mode: "i2v", usdPerSecond: { "480P": 0.025, "768P": 0.04 } },
];

export const DEFAULT_MODEL_ID = "minimax/h3-max/image-to-video";
export const RESOLUTIONS = ["480P", "768P"];
export const ASPECT_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
export const DURATION_MIN = 5;
export const DURATION_MAX = 15;

export function getModel(id) {
  return H3_MODELS.find((m) => m.id === id) || null;
}

export function isKnownModel(id) {
  return !!getModel(id);
}

export function clampDuration(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DURATION_MIN;
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, n));
}

export function normalizeResolution(value) {
  const v = String(value || "").toUpperCase();
  return RESOLUTIONS.includes(v) ? v : "768P";
}

/** fal.ai cost in USD for one clip. */
export function estimateUsd(modelId, resolution = "768P", duration = 5) {
  const m = getModel(modelId);
  if (!m) return 0;
  return m.usdPerSecond[normalizeResolution(resolution)] * clampDuration(duration);
}

/** Suggested credits per generated second for a model/resolution. */
export function creditsPerSecond(modelId, resolution = "768P", markup = PRICE_MARKUP) {
  const m = getModel(modelId);
  if (!m) return 0;
  const usd = m.usdPerSecond[normalizeResolution(resolution)];
  return Math.ceil((usd * markup) / CREDIT_USD);
}

export function suggestedCredits(modelId, resolution, duration) {
  return creditsPerSecond(modelId, resolution) * clampDuration(duration);
}

// Input keys each mode accepts. Anything else coming from a client is dropped.
const COMMON_INPUT_KEYS = ["prompt", "duration", "resolution", "seed", "prompt_expansion_mode", "enable_safety_checker"];
export const MODE_INPUT_KEYS = {
  t2v: [...COMMON_INPUT_KEYS, "aspect_ratio"],
  i2v: [...COMMON_INPUT_KEYS, "image_url", "end_image_url"],
  r2v: [...COMMON_INPUT_KEYS, "aspect_ratio", "reference_image_urls", "reference_video_urls", "reference_audio_urls"],
};

export function allowedInputKeys(modelId) {
  const m = getModel(modelId);
  return m ? MODE_INPUT_KEYS[m.mode] : COMMON_INPUT_KEYS;
}

export const LIST_INPUT_KEYS = ["reference_image_urls", "reference_video_urls", "reference_audio_urls"];
