import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCost } from "../src/lib/cost.js";

test("base cost only", () => {
  assert.equal(computeCost({ creditCost: 60 }), 60);
  assert.equal(computeCost({ creditCost: "60" }), 60);
  assert.equal(computeCost({}), 0);
});

test("slider cost per unit (duration)", () => {
  const cfg = { creditCost: 0, userParams: [{ key: "duration", type: "slider", defaultValue: 5, costPerUnit: 12 }] };
  assert.equal(computeCost(cfg, {}), 60);
  assert.equal(computeCost(cfg, { duration: 15 }), 180);
});

test("enum modifiers by option index", () => {
  const cfg = { creditCost: 40, userParams: [{ key: "resolution", type: "enum", options: ["480P", "768P"], costModifiers: [0, 20], defaultValue: "480P" }] };
  assert.equal(computeCost(cfg, {}), 40);
  assert.equal(computeCost(cfg, { resolution: "768P" }), 60);
  assert.equal(computeCost(cfg, { resolution: "4K" }), 40);
});

test("boolean extra cost and negative floor", () => {
  const cfg = { creditCost: 10, userParams: [{ key: "hd", type: "boolean", defaultValue: false, costIfTrue: 5 }] };
  assert.equal(computeCost(cfg, { hd: true }), 15);
  assert.equal(computeCost(cfg, { hd: "true" }), 15);
  assert.equal(computeCost({ creditCost: -5 }), 0);
});

test("hidden params never change the cost", () => {
  const cfg = { creditCost: 30, userParams: [{ key: "resolution", type: "hidden", defaultValue: "768P" }] };
  assert.equal(computeCost(cfg, { resolution: "480P" }), 30);
});
