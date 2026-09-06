// Image → text via fal's any-llm vision endpoint. Used to auto-fill prompt placeholders such as
// "describe the person in the avatar" so users never have to write that themselves.
import { getFal, hasFalKey } from "./fal";

export const VISION_ENDPOINT = "fal-ai/any-llm/vision";
export const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";
export const VISION_MODELS = ["google/gemini-2.5-flash", "anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4.5", "openai/gpt-4o"];

const SYSTEM_PROMPT =
  "You describe images for a video-generation prompt. Answer with the description only: no preamble, no markdown, no quotes, no bullet points.";

const MOCK_DESCRIPTION = "一位三十岁左右的男性，短发微卷、深棕色，戴黑色鸭舌帽，穿深蓝色牛仔外套，真实人像照片。";

export async function describeImage({ imageUrl, instruction, model = DEFAULT_VISION_MODEL, maxChars = 1200 }) {
  if (!hasFalKey()) return { text: MOCK_DESCRIPTION, mock: true };

  const chosen = VISION_MODELS.includes(model) ? model : DEFAULT_VISION_MODEL;
  const { data } = await getFal().subscribe(VISION_ENDPOINT, {
    input: {
      model: chosen,
      system_prompt: SYSTEM_PROMPT,
      prompt: instruction,
      image_urls: [imageUrl],
      temperature: 0.2,
      max_tokens: 400,
    },
  });
  if (data?.error) throw new Error(data.error);
  const text = String(data?.output || "").trim().replace(/^["“]|["”]$/g, "").slice(0, maxChars);
  if (!text) throw new Error("Vision model returned no description");
  return { text, mock: false, model: chosen };
}
