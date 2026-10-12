import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchScore } from "../src/lib/ora.mjs";

const res = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: new Headers(headers), json: async () => body });

test("a cached score is returned as number and grade", async () => {
  const r = await fetchScore("h.example", async () => res(200, { score: 66, grade: "C" }));
  assert.deepEqual(r, { host: "h.example", score: 66, grade: "C", status: 200 });
});

test("404 means no score, never zero", async () => {
  const r = await fetchScore("h.example", async () => res(404, { error: "not scanned" }));
  assert.equal(r.score, null);
  assert.equal(r.grade, null);
  assert.equal(r.status, 404);
});

test("429 waits Retry-After seconds and retries", async () => {
  const slept = [];
  const answers = [res(429, {}, { "retry-after": "7" }), res(200, { score: 90, grade: "A" })];
  const r = await fetchScore("h.example", async () => answers.shift(), async (ms) => { slept.push(ms); });
  assert.deepEqual(slept, [7000]);
  assert.equal(r.score, 90);
});

test("a network error is retried, and a lasting one comes back without a status", async () => {
  let n = 0;
  const flaky = async () => { n++; if (n < 3) throw new TypeError("fetch failed"); return res(200, { score: 50, grade: "D" }); };
  const r = await fetchScore("h.example", flaky, async () => {});
  assert.equal(r.score, 50);
  assert.equal(n, 3);
  const down = await fetchScore("h.example", async () => { throw new TypeError("fetch failed"); }, async () => {});
  assert.equal(down.status, null);
  assert.equal(down.score, null);
  assert.match(down.error, /fetch failed/);
});
