import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, isValidSlug } from "../src/lib/slug.js";
import { clampDuration, normalizeResolution, creditsPerSecond, suggestedCredits, allowedInputKeys, estimateUsd } from "../src/lib/models.js";

test("slugify", () => {
  assert.equal(slugify("Bring a Photo to Life!"), "bring-a-photo-to-life");
  assert.equal(slugify("  Café — Crème  "), "cafe-creme");
  assert.equal(slugify("产品展示"), "");
  assert.equal(isValidSlug("photo-to-life"), true);
  assert.equal(isValidSlug("-bad"), false);
  assert.equal(isValidSlug("UPPER"), false);
});

test("duration and resolution normalisation", () => {
  assert.equal(clampDuration(3), 5);
  assert.equal(clampDuration(99), 15);
  assert.equal(clampDuration("7.6"), 8);
  assert.equal(clampDuration("abc"), 5);
  assert.equal(normalizeResolution("768p"), "768P");
  assert.equal(normalizeResolution("1080P"), "768P");
});

test("pricing suggestions follow fal.ai list price × 1.5", () => {
  assert.equal(creditsPerSecond("minimax/h3-max/text-to-video", "768P"), 12);
  assert.equal(creditsPerSecond("minimax/h3-max-turbo/text-to-video", "480P"), 4);
  assert.equal(suggestedCredits("minimax/h3-max/image-to-video", "768P", 5), 60);
  assert.equal(estimateUsd("minimax/h3-max-turbo/text-to-video", "480P", 5), 0.125);
  assert.equal(creditsPerSecond("unknown/model"), 0);
});

test("input whitelist per mode", () => {
  assert.ok(allowedInputKeys("minimax/h3-max/text-to-video").includes("aspect_ratio"));
  assert.ok(!allowedInputKeys("minimax/h3-max/image-to-video").includes("aspect_ratio"));
  assert.ok(allowedInputKeys("minimax/h3-max/reference-to-video").includes("reference_image_urls"));
  assert.ok(!allowedInputKeys("minimax/h3-max/text-to-video").includes("sync_mode"));
});
