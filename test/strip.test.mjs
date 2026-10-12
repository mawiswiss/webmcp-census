import { test } from "node:test";
import assert from "node:assert/strict";
import { stripPage } from "../src/lib/strip.mjs";

test("stripPage drops result and args from every smoke run and keeps the rest", () => {
  const page = { url: "https://h.example/", status: "ok", smoke: { findings: [], counts: {}, runs: [
    { tool: "a", kind: "required", label: "x", args: { q: "secret" }, ok: true, result: { rows: [1] }, durationMs: 12, writes: [] },
  ] } };
  const out = stripPage(page);
  assert.deepEqual(out.smoke.runs[0], { tool: "a", kind: "required", label: "x", ok: true, durationMs: 12, writes: [] });
  assert.ok("args" in page.smoke.runs[0], "input untouched");
});

test("stripPage leaves a page without smoke alone", () => {
  const page = { url: "https://h.example/", status: "error", error: "timeout" };
  assert.deepEqual(stripPage(page), page);
});
