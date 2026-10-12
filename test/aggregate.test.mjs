import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, summarizeSite, summarize, toCsv, RULES } from "../src/lib/aggregate.mjs";

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
  assert.equal(row.tools_passed, 1, "liar fails on result-writes");
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
  assert.deepEqual(s.sites, { total: 5, scanned: 4, tools: 1, no_tools: 1, blocked: 1, error: 1, skipped: 1 });
  assert.equal(s.tools.seen, 3);
  assert.equal(s.tools.readonly_pct, 66.7);
  assert.equal(s.tools.passed_pct, 50);
  assert.equal(s.runs.valid_ok_pct, 100);
  assert.equal(s.sites_with_readonly_writes, 1);
  assert.equal(s.rules["result-writes"].sites, 1);
  assert.equal(s.by_category.Commerce.sites, 1);
  assert.equal(s.by_ora_grade.C.tools_passed_pct, 50);
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
