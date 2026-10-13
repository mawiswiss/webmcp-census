import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRules, SMOKE_RULES } from "@swissspidy/webmcp-lint";
import { classify, classifyWrite, summarizeSite, summarize, toCsv, RULES } from "../src/lib/aggregate.mjs";

const ro = { readOnlyHint: true };
const tool = (name, annotations, inputSchema = { type: "object", properties: {} }) => ({ name, description: "x".repeat(30), inputSchema, annotations, source: "imperative", origin: "https://a.example", frame: 0 });
const searchSchema = { type: "object", properties: { q: { type: "string", description: "The query." }, limit: { type: "number" } } };
const siteA = { category: "Commerce", toolCount: 4, tools: [{ name: "search", kind: "answer" }, { name: "submit_order", kind: "act" }] };

const withTools = {
  status: "ok", host: "a.example", probe: null,
  pages: [{
    url: "https://a.example/", status: "ok",
    snapshot: { url: "https://a.example/", frames: [{ api: "native" }], tools: [tool("search", ro, searchSchema), tool("liar", ro), tool("submit_order", { consequentialHint: true })] },
    lint: { findings: [{ ruleId: "param-description-missing", severity: "warning", tool: "search" }], counts: { error: 0, warning: 1, info: 0 } },
    smoke: {
      runs: [
        { tool: "search", kind: "required", ok: true, durationMs: 10 }, { tool: "search", kind: "boundary", ok: true, durationMs: 10 }, { tool: "search", kind: "invalid", ok: false, durationMs: 10 },
        { tool: "liar", kind: "required", ok: true, durationMs: 10, writes: [{ method: "POST", url: "https://a.example/track" }] },
      ],
      findings: [{ ruleId: "result-writes", severity: "error", tool: "liar" }],
      counts: { error: 1, warning: 0, info: 0 },
    },
  }],
};
const blocked = { status: "ok", host: "b.example", probe: { status: 403, title: "Just a moment...", blocked: true }, pages: [{ url: "https://b.example/", status: "ok", snapshot: { frames: [{ api: "native" }], tools: [] }, lint: { findings: [], counts: {} }, smoke: { runs: [], findings: [], counts: {} } }] };
const empty = { status: "ok", host: "c.example", probe: { status: 200, title: "Welcome", blocked: false }, pages: [{ url: "https://c.example/", status: "ok", snapshot: { frames: [{ api: "native" }], tools: [] }, lint: { findings: [], counts: {} }, smoke: { runs: [], findings: [], counts: {} } }] };
const failed = { status: "error", host: "d.example", error: "timeout" };
const skipped = { status: "skipped", host: "e.example", reason: "robots" };

test("classify separates tools, no-tools, blocked, error and skipped", () => {
  assert.equal(classify(withTools), "tools");
  assert.equal(classify(blocked), "blocked");
  assert.equal(classify(empty), "no-tools");
  assert.equal(classify(failed), "error");
  assert.equal(classify(skipped), "skipped");
  assert.equal(classify({ status: "ok", host: "f", pages: [{ status: "error", error: "net::ERR" }] }), "error");
});

test("summarizeSite counts tools, annotations, runs, passes and findings", () => {
  const row = summarizeSite(withTools, siteA, { score: 66, grade: "C" });
  assert.equal(row.host, "a.example");
  assert.equal(row.category, "Commerce");
  assert.equal(row.directory_tools, 4);
  assert.equal(row.directory_act_tools, 1);
  assert.equal(row.directory_act_share, 50);
  assert.equal(row.status, "tools");
  assert.equal(row.tools_seen, 3);
  assert.equal(row.tools_annotated, 3);
  assert.equal(row.tools_readonly, 2);
  assert.equal(row.tools_consequential, 1);
  assert.equal(row.tools_titled, 0);
  assert.equal(row.tools_exposed, 0);
  assert.equal(row.desc_len_median, 30);
  assert.equal(row.params_total, 2);
  assert.equal(row.params_described, 1);
  assert.equal(row.params_described_pct, 50);
  assert.equal(row.tools_executed, 2);
  assert.equal(row.tools_passed, 2, "a POST alone does not fail a tool");
  assert.equal(row.runs_valid, 3);
  assert.equal(row.runs_valid_ok, 3);
  assert.equal(row.lint_errors, 0);
  assert.equal(row.lint_warnings, 1);
  assert.equal(row.r_result_writes, 1);
  assert.equal(row.r_param_description_missing, 1);
  assert.equal(row.ora_score, 66);
  assert.equal(row.ora_grade, "C");
});

test("a missing Ora score stays empty", () => {
  const row = summarizeSite(withTools, { category: "Commerce" }, { score: null, grade: null, status: 404 });
  assert.equal(row.ora_score, "");
  assert.equal(row.ora_grade, "");
  assert.equal(summarizeSite(withTools, {}, undefined).ora_score, "");
});

test("ratios without a denominator stay empty", () => {
  const row = summarizeSite(empty, {}, undefined);
  assert.equal(row.params_described_pct, "");
  assert.equal(row.directory_act_share, "");
  assert.equal(row.desc_len_median, "");
});

test("summarize produces the headline numbers", () => {
  const rows = [
    summarizeSite(withTools, { category: "Commerce" }, { score: 66, grade: "C" }),
    summarizeSite(blocked, { category: "Commerce" }, undefined),
    summarizeSite(empty, { category: "Demos" }, undefined),
    summarizeSite(failed, {}, undefined),
    summarizeSite(skipped, {}, undefined),
  ];
  const s = summarize(rows);
  assert.deepEqual(s.sites, { total: 5, scanned: 4, tools: 1, no_tools: 1, blocked: 1, error: 1, skipped: 1, with_calls: 1, nothing_to_call: 0 });
  assert.equal(s.tools.seen, 3);
  assert.equal(s.tools.readonly_pct, 66.7);
  assert.equal(s.tools.passed_pct, 100);
  assert.equal(s.runs.valid_ok_pct, 100);
  assert.equal(s.sites_with_readonly_writes, 1);
  assert.equal(s.rules["result-writes"].sites, 1);
  assert.equal(s.by_category.Commerce.sites, 1);
  assert.equal(s.by_ora_grade.C.tools_passed_pct, 100);
});

test("toCsv quotes commas and quotes", () => {
  assert.equal(toCsv([{ host: "a", category: 'Travel, "Events"' }]), 'host,category\na,"Travel, ""Events"""\n');
  assert.equal(toCsv([]), "");
});

test("every rule gets a column", () => {
  const row = summarizeSite(empty, {}, undefined);
  for (const id of RULES) assert.ok(`r_${id.replace(/-/g, "_")}` in row, id);
});

test("a stand-in navigator.modelContext marks a site as legacy", () => {
  const legacy = { ...empty, host: "g.example", probe: { status: 200, title: "Shop", blocked: false, legacy: true, legacyTools: 3 } };
  const row = summarizeSite(legacy, {}, undefined);
  assert.equal(row.status, "no-tools");
  assert.equal(row.legacy_surface, 1);
  assert.equal(row.legacy_tools, 3);
  const plain = summarizeSite(empty, {}, undefined);
  assert.equal(plain.legacy_surface, 0);
  assert.equal(plain.legacy_tools, 0);
  assert.equal(summarize([row, plain]).sites_legacy_surface, 1);
});

test("tools left unfinished by the time budget are counted, not executed", () => {
  const cut = { ...withTools, host: "h.example", pages: [{ ...withTools.pages[0], smoke: { ...withTools.pages[0].smoke, unfinished: ["submit_order", "other"] } }] };
  const row = summarizeSite(cut, siteA, undefined);
  assert.equal(row.tools_unfinished, 2);
  assert.equal(summarizeSite(withTools, siteA, undefined).tools_unfinished, 0);
  assert.equal(summarize([row]).sites_with_unfinished_tools, 1);
});

test("same-origin POSTs are sorted into MCP relays, analytics and other targets", () => {
  assert.equal(classifyWrite("https://a.example/api/mcp"), "mcp");
  assert.equal(classifyWrite("https://a.example/mcp/"), "mcp");
  assert.equal(classifyWrite("https://a.example/wp-json/x/v1/mcp"), "mcp");
  assert.equal(classifyWrite("https://a.example/webmcp/rpc"), "mcp");
  assert.equal(classifyWrite("https://a.example/api/webmcp.php"), "mcp");
  assert.equal(classifyWrite("https://a.example/cdn-cgi/rum"), "analytics");
  assert.equal(classifyWrite("https://a.example/ruyh/ga/g/c"), "analytics");
  assert.equal(classifyWrite("https://a.example/ruyh/gs/ccm/collect"), "analytics");
  assert.equal(classifyWrite("https://a.example/.well-known/shopify/monorail/unstable/produce_batch"), "analytics");
  assert.equal(classifyWrite("https://a.example/api/telemetry/web-vitals"), "analytics");
  assert.equal(classifyWrite("https://a.example/monitoring"), "analytics");
  assert.equal(classifyWrite("https://a.example/api/tools/search_apartments"), "other");
  assert.equal(classifyWrite("https://a.example/api/booking/availability"), "other");
  assert.equal(classifyWrite("https://a.example/track"), "other");
});

test("a site's same-origin POSTs are counted by kind, cross-origin ones are not", () => {
  const row = summarizeSite(withTools, siteA, undefined);
  assert.equal(row.tools_posting, 1);
  assert.equal(row.post_targets_other, 1);
  assert.equal(row.post_targets_mcp, 0);
  assert.equal(row.post_targets_analytics, 0);
  const crossOnly = { ...withTools, pages: [{ ...withTools.pages[0], smoke: { ...withTools.pages[0].smoke, runs: [{ tool: "liar", kind: "valid-minimal", ok: true, durationMs: 5, writes: [{ method: "POST", url: "https://ga.example/g/collect", crossOrigin: true }] }] } }] };
  assert.equal(summarizeSite(crossOnly, siteA, undefined).tools_posting, 0);
  assert.deepEqual(summarize([row]).sites_posting, { any: 1, mcp: 0, analytics: 0, other: 1 });
});

test("every rule the engine knows has a column, so no finding goes uncounted", () => {
  for (const id of [...builtinRules.map((r) => r.id), ...Object.keys(SMOKE_RULES)].filter((id) => id !== "no-tools")) assert.ok(RULES.includes(id), id);
  const page = { ...withTools.pages[0], smoke: { ...withTools.pages[0].smoke, findings: [{ ruleId: "result-string-json", severity: "info", tool: "search" }] } };
  assert.equal(summarizeSite({ ...withTools, pages: [page] }, siteA, undefined).r_result_string_json, 1);
});

test("the summary carries what the directory claimed per outcome and per API surface", () => {
  const rows = [
    summarizeSite(withTools, { ...siteA, apiSurface: "spec" }, undefined),
    summarizeSite(empty, { category: "Demos", toolCount: 3, apiSurface: "polyfill" }, undefined),
    summarizeSite(blocked, { category: "Commerce", toolCount: 2, apiSurface: "spec" }, undefined),
  ];
  assert.equal(rows[0].api_surface, "spec");
  const s = summarize(rows);
  assert.deepEqual(s.directory_claimed_by_status, { tools: 4, "no-tools": 3, blocked: 2 });
  assert.deepEqual(s.by_api_surface, { polyfill: { "no-tools": 1 }, spec: { tools: 1, blocked: 1 } });
  assert.equal(s.sites.with_calls, 1);
  assert.equal(s.sites.nothing_to_call, 0);
});

test("a tool listed on two pages counts its calls and findings once", () => {
  const page = (url) => ({
    url, status: "ok",
    snapshot: { frames: [{ api: "native" }], tools: [tool("search", ro, searchSchema)] },
    lint: { findings: [{ ruleId: "param-description-missing", severity: "warning", tool: "search", message: "limit has no description" }], counts: {} },
    smoke: { runs: [{ tool: "search", kind: "valid-minimal", label: "no parameters", ok: true }, { tool: "search", kind: "boundary", label: "q empty string", ok: true }], findings: [{ ruleId: "result-too-large", severity: "warning", tool: "search" }], counts: {} },
  });
  const raw = { status: "ok", host: "two.example", probe: null, pages: [page("https://two.example/"), page("https://two.example/search")] };
  const row = summarizeSite(raw, {}, undefined);
  assert.equal(row.runs_valid, 2);
  assert.equal(row.tools_executed, 1);
  assert.equal(row.r_param_description_missing, 1);
  assert.equal(row.r_result_too_large, 1);
});
