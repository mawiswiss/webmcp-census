import { test } from "node:test";
import assert from "node:assert/strict";
import { median, mean, pct, spearman } from "../src/lib/stats.mjs";

test("median handles odd, even, empty and non-numbers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([null, "", 5]), 5);
});

test("mean rounds to two decimals and pct to one", () => {
  assert.equal(mean([1, 2]), 1.5);
  assert.equal(mean([]), null);
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(0, 0), null);
});

test("spearman ranks both lists, averages ties and needs three pairs", () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  assert.equal(spearman([1, 2, 2, 3], [1, 2, 2, 3]), 1);
  assert.equal(spearman([1, 2], [1, 2]), null);
});
