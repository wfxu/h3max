// Turns an app's parameter design + a client request into (a) values for cost calculation
// and (b) a whitelisted fal.ai input object. Hidden params always use the admin-configured value.
import { allowedInputKeys, clampDuration, normalizeResolution, LIST_INPUT_KEYS, ASPECT_RATIOS } from "./models.js";

const MAX_TEXT = 5000;
const UPLOAD_TYPES = ["image_list", "video_list", "audio_list"];

export function safeParseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isUrlLike(value) {
  return typeof value === "string" && /^(https?:\/\/|data:(image|video|audio)\/)/i.test(value) && value.length < 20_000_000;
}

function isEmpty(v) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function wantsList(param) {
  return LIST_INPUT_KEYS.includes(param.key) || param.key.endsWith("_list") || (Number(param.maxInputs) || 1) > 1;
}

function coerce(param, value) {
  const type = param.type;
  if (UPLOAD_TYPES.includes(type)) {
    const list = (Array.isArray(value) ? value : value ? [value] : []).filter(isUrlLike);
    const asList = wantsList(param);
    const max = Math.max(1, Math.min(12, Number(param.maxInputs) || (asList ? 9 : 1)));
    return asList ? list.slice(0, max) : list[0] || "";
  }
  if (type === "boolean") return value === true || value === "true" || value === 1 || value === "1";
  if (type === "number" || type === "slider") {
    let n = Number(value);
    if (!Number.isFinite(n)) n = Number(param.defaultValue) || 0;
    if (param.min !== undefined && param.min !== "" && param.min !== null) n = Math.max(Number(param.min), n);
    if (param.max !== undefined && param.max !== "" && param.max !== null) n = Math.min(Number(param.max), n);
    if (param.key === "duration") n = clampDuration(n);
    return n;
  }
  if (type === "enum") {
    const options = Array.isArray(param.options) ? param.options : [];
    const v = String(value ?? "");
    if (options.length && !options.includes(v)) return String(param.defaultValue ?? options[0]);
    return v;
  }
  if (value === undefined || value === null) return "";
  return String(value).slice(0, MAX_TEXT);
}

/** Final prompt = admin's hidden prefix + what the user typed (either may be empty). */
export function buildPrompt(parsedConfig, userPrompt) {
  const prefix = String(parsedConfig?.systemPrompt || "").trim();
  const user = String(userPrompt || "").trim().slice(0, MAX_TEXT);
  const template = parsedConfig?.promptTemplate ? String(parsedConfig.promptTemplate) : "";
  if (template.includes("{prompt}")) {
    return template.replace("{prompt}", user).trim();
  }
  return [prefix, user].filter(Boolean).join(" ").trim();
}

export function resolveParams(parsedConfig, body = {}, modelId) {
  const params = Array.isArray(parsedConfig?.userParams) ? parsedConfig.userParams : [];
  const allowed = new Set(allowedInputKeys(modelId));
  const values = {};
  const input = {};

  for (const p of params) {
    if (!p || typeof p.key !== "string" || !p.key || p.key === "prompt") continue;
    const raw = p.type === "hidden" ? p.defaultValue : body[p.key] !== undefined ? body[p.key] : p.defaultValue;
    const v = p.type === "hidden" ? raw : coerce(p, raw);
    values[p.key] = v;
    if (allowed.has(p.key) && !isEmpty(v)) input[p.key] = v;
  }

  // Baked-in settings from the app config, unless a user param already covers the key.
  const fixed = {
    duration:
      parsedConfig?.duration !== undefined && parsedConfig?.duration !== "" && parsedConfig?.duration !== null
        ? clampDuration(parsedConfig.duration)
        : undefined,
    resolution: parsedConfig?.resolution ? normalizeResolution(parsedConfig.resolution) : undefined,
    aspect_ratio: ASPECT_RATIOS.includes(parsedConfig?.aspectRatio) ? parsedConfig.aspectRatio : undefined,
  };
  for (const [k, v] of Object.entries(fixed)) {
    if (input[k] === undefined && allowed.has(k) && !isEmpty(v)) input[k] = v;
  }

  if (input.resolution) input.resolution = normalizeResolution(input.resolution);
  if (input.duration !== undefined) input.duration = clampDuration(input.duration);

  return { values, input };
}
