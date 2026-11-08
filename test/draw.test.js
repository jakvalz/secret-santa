import test from "node:test";
import assert from "node:assert/strict";
import { runDraw } from "../netlify/lib/draw.js";

test("basic derangement for 3 people", () => {
  const ids = ["a", "b", "c"];
  const result = runDraw(ids, []);
  assert.ok(result);
  assert.equal(Object.keys(result).length, 3);
  for (const g of ids) {
    assert.notEqual(result[g], g);
    assert.ok(ids.includes(result[g]));
  }
  const receivers = Object.values(result);
  assert.equal(new Set(receivers).size, 3);
});

test("respects exclusions", () => {
  const ids = ["a", "b", "c"];
  // Force a cycle-friendly exclusions: a cannot get b
  for (let i = 0; i < 30; i++) {
    const result = runDraw(ids, [{ from: "a", to: "b" }]);
    assert.ok(result);
    assert.notEqual(result.a, "b");
  }
});

test("impossible when someone has no options", () => {
  const ids = ["a", "b"];
  const result = runDraw(ids, [
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ]);
  assert.equal(result, null);
});

test("needs at least two", () => {
  assert.equal(runDraw(["a"], []), null);
});
