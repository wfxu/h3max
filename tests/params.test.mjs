import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParams, buildPrompt, safeParseConfig, isUrlLike } from "../src/lib/params.js";

const I2V = "minimax/h3-max/image-to-video";
const T2V = "minimax/h3-max/text-to-video";
const R2V = "minimax/h3-max/reference-to-video";

test("baked-in settings become fal input; unknown keys from the client are dropped", () => {
  const cfg = { duration: 5, resolution: "768p", aspectRatio: "16:9" };
  const { input } = resolveParams(cfg, { sync_mode: true, prompt: "x", image_url: "https://evil" }, T2V);
  assert.deepEqual(input, { duration: 5, resolution: "768P", aspect_ratio: "16:9" });
});

test("aspect ratio is not sent to image-to-video", () => {
  const { input } = resolveParams({ aspectRatio: "9:16", duration: 8 }, {}, I2V);
  assert.equal(input.aspect_ratio, undefined);
  assert.equal(input.duration, 8);
});

test("hidden params ignore client values; visible params accept them", () => {
  const cfg = {
    userParams: [
      { key: "resolution", type: "hidden", defaultValue: "480P" },
      { key: "duration", type: "slider", defaultValue: 5, min: 5, max: 15 },
    ],
  };
  const { values, input } = resolveParams(cfg, { resolution: "768P", duration: 99 }, T2V);
  assert.equal(values.resolution, "480P");
  assert.equal(input.resolution, "480P");
  assert.equal(input.duration, 15, "duration is clamped to the model's 5–15 range");
});

test("upload params: single vs list, only URL-like strings survive", () => {
  const cfg = {
    userParams: [
      { key: "image_url", type: "image_list", maxInputs: 1 },
      { key: "reference_image_urls", type: "image_list", maxInputs: 3 },
    ],
  };
  const { input: i2v } = resolveParams(cfg, { image_url: ["https://a/x.png", "javascript:alert(1)"] }, I2V);
  assert.equal(i2v.image_url, "https://a/x.png");
  assert.equal(i2v.reference_image_urls, undefined, "not allowed for i2v");

  const { input: r2v } = resolveParams(cfg, { reference_image_urls: ["https://a/1.png", "ftp://no", "data:image/png;base64,AAAA", "https://a/3.png", "https://a/4.png"] }, R2V);
  assert.deepEqual(r2v.reference_image_urls, ["https://a/1.png", "data:image/png;base64,AAAA", "https://a/3.png"]);
});

test("enum falls back to default when the client sends an unknown option", () => {
  const cfg = { userParams: [{ key: "resolution", type: "enum", options: ["480P", "768P"], defaultValue: "768P" }] };
  const { input } = resolveParams(cfg, { resolution: "4K" }, T2V);
  assert.equal(input.resolution, "768P");
});

test("buildPrompt joins the hidden prefix and the user text, or uses a template", () => {
  assert.equal(buildPrompt({ systemPrompt: "Cinematic." }, "  a cat  "), "Cinematic. a cat");
  assert.equal(buildPrompt({ systemPrompt: "Only prefix." }, ""), "Only prefix.");
  assert.equal(buildPrompt({}, ""), "");
  assert.equal(buildPrompt({ promptTemplate: "Shot of {prompt}, 35mm" }, "a dog"), "Shot of a dog, 35mm");
});

test("safeParseConfig and isUrlLike", () => {
  assert.deepEqual(safeParseConfig("not json"), {});
  assert.deepEqual(safeParseConfig('{"a":1}'), { a: 1 });
  assert.equal(isUrlLike("https://x.y/z.mp4"), true);
  assert.equal(isUrlLike("data:video/mp4;base64,AA"), true);
  assert.equal(isUrlLike("file:///etc/passwd"), false);
  assert.equal(isUrlLike(42), false);
});
