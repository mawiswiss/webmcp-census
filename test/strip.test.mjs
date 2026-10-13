import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { scrubRecord, stripPage } from "../src/lib/strip.mjs";

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

test("stripPage takes query strings and machine details out of everything it keeps", () => {
  const page = {
    url: "https://h.example/", status: "ok",
    snapshot: {
      url: "https://h.example/?utm=1",
      frames: [{ url: "https://w.example/widget?timezone=America/Denver", origin: "https://w.example", error: "net::ERR at 10.0.0.2" }],
      tools: [{ name: "a", description: "See https://h.example/docs?ref=x", location: { url: "https://h.example/app.js?v=9", line: 1, column: 2 } }],
    },
    lint: { findings: [{ ruleId: "r", message: "m https://x.example/?sid=1" }] },
    smoke: {
      findings: [{ ruleId: "result-writes", message: "POST https://ga.example/collect?cid=1.2&tz=America%2FDenver", tool: "a" }],
      counts: {},
      runs: [{ tool: "a", kind: "valid-minimal", ok: false, error: `boom at ${homedir()}/x`, args: {}, result: 1, durationMs: 1, navigatedTo: "https://h.example/next?session=abc", writes: [{ method: "POST", url: "https://ga.example/collect?cid=1.2" }] }],
    },
  };
  const out = stripPage(page);
  assert.equal(out.snapshot.url, "https://h.example/");
  assert.equal(out.snapshot.frames[0].url, "https://w.example/widget");
  assert.ok(!out.snapshot.frames[0].error.includes("10.0.0.2"));
  assert.equal(out.snapshot.tools[0].location.url, "https://h.example/app.js");
  assert.equal(out.snapshot.tools[0].description, "See https://h.example/docs?ref=x", "site-authored text stays as published");
  assert.ok(!out.lint.findings[0].message.includes("sid="));
  assert.equal(out.smoke.findings[0].message, "POST https://ga.example/collect");
  const run = out.smoke.runs[0];
  assert.equal(run.navigatedTo, "https://h.example/next");
  assert.equal(run.writes[0].url, "https://ga.example/collect");
  assert.ok(!run.error.includes(homedir()));
  assert.ok(!("args" in run) && !("result" in run));
  assert.equal(page.snapshot.frames[0].url, "https://w.example/widget?timezone=America/Denver", "input untouched");
});

test("scrubRecord cleans a stored host record, and a clean record stays as it is", () => {
  const r = { status: "error", host: "h.example", error: `at ${homedir()}/a.mjs from 10.0.0.1`, probe: { status: null, error: "connect - Local (10.0.0.9:51000)" }, pages: [{ url: "https://h.example/", status: "error", error: "failed https://h.example/?q=1" }] };
  const out = scrubRecord(r);
  const text = JSON.stringify(out);
  assert.ok(!text.includes(homedir()) && !text.includes("10.0.0"), text);
  assert.equal(out.pages[0].error, "failed https://h.example/");
  assert.deepEqual(scrubRecord(out), out);
  assert.deepEqual(scrubRecord({ status: "skipped", host: "h.example", reason: "robots" }), { status: "skipped", host: "h.example", reason: "robots" });
});

test("stored findings keep no generated call input and no long echoes", () => {
  const page = { url: "https://h.example/", status: "ok", smoke: { counts: {}, runs: [], findings: [
    { ruleId: "result-error-on-valid-input", tool: "a", message: `Tool "a" failed: ${"x".repeat(2000)}`, help: 'Input was {"q":"example"}' },
    { ruleId: "result-too-large", tool: "a", message: "Result is 4,000 characters.", help: "Paginate or summarise." },
  ] } };
  const [failed, large] = stripPage(page).smoke.findings;
  assert.ok(!("help" in failed), "the generated input is gone");
  assert.equal(failed.message.length, 500);
  assert.equal(large.help, "Paginate or summarise.", "advice stays");
});
