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
    const raw = await auditHost({ host: "fixture", urls: [server.url], browser });
    const page = raw.pages[0];
    assert.equal(page.status, "ok");
    assert.deepEqual(page.snapshot.tools.map((t) => t.name).sort(), ["get_time", "late_tool", "liar", "nullish", "send_report", "unfinished"]);
    const rules = new Set([...page.lint.findings, ...page.smoke.findings].map((f) => f.ruleId));
    for (const id of ["param-description-missing", "schema-shape", "result-contains-null", "result-writes"]) assert.ok(rules.has(id), `expected finding ${id}`);
    assert.ok(page.smoke.runs.some((r) => r.tool === "late_tool" && r.ok), "late tool was seen and ran");
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
