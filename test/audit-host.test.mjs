import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixtures/serve.mjs";
import { auditHost, launchArgs } from "../src/lib/audit-host.mjs";
import { UA } from "../src/lib/ua.mjs";

test("the harness sees every broken thing in the fixture and nothing it must not touch", async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ args: launchArgs() });
  try {
    const raw = await auditHost({ host: "fixture", urls: [server.url], browser, callLimitMs: 1500 });
    const page = raw.pages[0];
    assert.equal(page.status, "ok");
    assert.deepEqual(page.snapshot.tools.map((t) => t.name).sort(), ["get_time", "gql_reader", "gql_writer", "hang_tool", "jump_tool", "late_tool", "liar", "nullish", "send_report", "unfinished"]);
    const rules = new Set([...page.lint.findings, ...page.smoke.findings].map((f) => f.ruleId));
    for (const id of ["param-description-missing", "schema-shape", "result-contains-null", "result-writes"]) assert.ok(rules.has(id), `expected finding ${id}`);
    assert.ok(page.smoke.runs.some((r) => r.tool === "late_tool" && r.ok), "late tool was seen and ran");
    assert.ok(page.smoke.runs.some((r) => r.tool === "jump_tool" && /elsewhere/.test(r.navigatedTo ?? "")), "the navigating tool is caught");
    const later = page.smoke.runs.filter((r) => r.tool === "get_time");
    assert.ok(later.length > 0 && later.every((r) => r.ok), "a tool called after a navigating one runs on the original page");
    const hang = page.smoke.runs.filter((r) => r.tool === "hang_tool");
    assert.ok(hang.length >= 2, "the hanging tool had several generated calls");
    assert.match(hang[0].error, /did not answer within 1500 ms/);
    assert.ok(hang.slice(1).every((r) => !r.ok && /skipped/.test(r.error)), "later calls of a hanging tool are skipped");
    const writers = new Set(page.smoke.findings.filter((f) => f.ruleId === "result-writes").map((f) => f.tool));
    assert.deepEqual([...writers].sort(), ["gql_writer", "liar"], "a GraphQL query is a read, a mutation and a plain POST are writes");
    assert.ok(!page.smoke.runs.some((r) => r.tool === "send_report"), "side-effect name never executed");
    assert.ok(!page.smoke.runs.some((r) => r.tool === "unfinished"), "tool without readOnlyHint never executed");
    assert.ok(page.smoke.runs.every((r) => !("result" in r) && !("args" in r)), "results and args stripped");
    assert.ok(!server.requests.some((r) => r.url === "/send"), "no request from the excluded tool");
    assert.ok(server.requests.every((r) => r.ua === UA), "census user agent on every request");
    assert.equal(raw.probe, null, "no probe when tools were seen");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("a page that registers only on a stand-in navigator.modelContext is reported as legacy", async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ args: launchArgs() });
  try {
    const raw = await auditHost({ host: "fixture", urls: [`${server.url}legacy`], browser });
    assert.equal(raw.pages[0].snapshot.tools.length, 0, "the browser sees no tools");
    assert.equal(raw.probe.blocked, false);
    assert.equal(raw.probe.legacy, true);
    assert.equal(raw.probe.legacyTools, 1);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("a host whose time budget is used up keeps its tool definitions and lists what it did not call", async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ args: launchArgs() });
  try {
    const started = Date.now();
    const raw = await auditHost({ host: "fixture", urls: [server.url], browser, callLimitMs: 1500, budgetMs: 1 });
    const page = raw.pages[0];
    assert.equal(page.status, "ok");
    assert.ok(page.snapshot.tools.length > 0, "tool definitions are kept");
    assert.equal(page.smoke.runs.length, 0);
    assert.ok(page.smoke.unfinished.includes("get_time"));
    assert.match(page.smoke.aborted, /time budget/);
    assert.ok(Date.now() - started < 15_000, "it returned without calling anything");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("a page whose load event never fires is still audited", async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ args: launchArgs() });
  try {
    const started = Date.now();
    const raw = await auditHost({ host: "fixture", urls: [`${server.url}slowload`], browser, callLimitMs: 1500, loadTimeoutMs: 2000 });
    const page = raw.pages[0];
    assert.equal(page.status, "ok", page.error);
    assert.deepEqual(page.snapshot.tools.map((t) => t.name), ["get_opening_hours"]);
    assert.ok(page.smoke.runs.some((r) => r.tool === "get_opening_hours" && r.ok));
    assert.ok(Date.now() - started < 20_000, "the load wait is bounded");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("a page whose main thread never answers is recorded as an error within the limits", async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ args: launchArgs() });
  try {
    const started = Date.now();
    const raw = await auditHost({ host: "fixture", urls: [`${server.url}busy`], browser, callLimitMs: 1500, loadTimeoutMs: 2000, snapshotTimeoutMs: 2000, probeTimeoutMs: 4000 });
    assert.equal(raw.pages[0].status, "error");
    assert.match(raw.pages[0].error, /did not finish within 2000 ms/);
    assert.match(raw.probe.error, /did not finish within 4000 ms/);
    assert.ok(Date.now() - started < 40_000, `took ${Date.now() - started} ms`);
  } finally {
    await browser.close();
    await server.close();
  }
});
