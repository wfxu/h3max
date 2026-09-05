import { fal } from "@fal-ai/client";
import config from "./config";

/** True when a real fal.ai key is configured; otherwise the app runs in mock mode. */
export function hasFalKey() {
  const key = config.ai.falKey;
  return typeof key === "string" && key.trim().length > 10 && !/placeholder|your_/i.test(key);
}

let configured = false;
export function getFal() {
  if (!configured) {
    fal.config({ credentials: config.ai.falKey, suppressLocalCredentialsWarning: true });
    configured = true;
  }
  return fal;
}
