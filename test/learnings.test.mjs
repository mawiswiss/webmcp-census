import { test } from "node:test";
import assert from "node:assert/strict";
import { baseline, topVsRest, gaps, lowHangingFruits, nextThings, learnings } from "../src/lib/learnings.mjs";

const base = {
  status: "tools", category: "Commerce", tools_seen: 2, tools_imperative: 2, tools_annotated: 1, tools_readonly: 1, tools_consequential: 0,
  tools_untrusted: 0, tools_titled: 0, tools_exposed: 0, tools_executed: 2, tools_passed: 1, lint_errors: 0, desc_len_median: 40,
  params_described_pct: 50, directory_act_tools: 0, directory_act_share: 0,
  r_param_description_missing: 0, r_result_contains_null: 0, r_result_writes: 0, r_description_length: 0,
};
const row = (host, o = {}) => ({ host, ...base, ...o });
const rows = [
  row("best.example", { tools_seen: 3, tools_imperative: 3, tools_executed: 3, tools_passed: 3, tools_annotated: 3, desc_len_median: 120, params_described_pct: 100 }),
  row("worst.example", { tools_seen: 3, tools_executed: 2, tools_passed: 0, tools_annotated: 0, r_param_description_missing: 4, r_result_contains_null: 1 }),
  row("mid.example", { r_param_description_missing: 1, tools_consequential: 1, directory_act_tools: 1, directory_act_share: 50 }),
  ...Array.from({ length: 7 }, (_, i) => row(`site${i}.example`, { tools_passed: i % 2 ? 2 : 1 })),
  row("quiet.example", { status: "no-tools", tools_seen: 0, tools_executed: 0, tools_passed: 0, tools_annotated: 0 }),
];

test("baseline is the median over sites with tools and ignores the rest", () => {
  const b = baseline(rows);
  assert.equal(b.sites, 10);
  assert.equal(b.tools_seen, 2);
  assert.equal(b.pass_rate_median, 50);
  assert.equal(b.desc_len_median, 40);
});

test("topVsRest puts the best pass rate in the top decile and compares traits", () => {
  const t = topVsRest(rows);
  assert.equal(t.top_sites, 1);
  assert.deepEqual(t.top_hosts, ["best.example"]);
  assert.equal(t.rest_sites, 9);
  assert.equal(t.traits.pass_rate.top, 1);
  assert.equal(t.traits.desc_len_median.top, 120);
  assert.ok(t.traits.annotated_share.top > t.traits.annotated_share.rest);
});

test("lowHangingFruits ranks cheap fixes by sites and counts tools a single fix would flip", () => {
  const raws = [{ pages: [{ smoke: { findings: [
    { ruleId: "result-contains-null", tool: "a" },
    { ruleId: "result-contains-null", tool: "b" }, { ruleId: "result-writes", tool: "b" },
  ] } }] }];
  const fruits = lowHangingFruits(rows, raws);
  assert.equal(fruits[0].rule, "annotations-missing");
  const param = fruits.find((f) => f.rule === "param-description-missing");
  assert.equal(param.sites, 2);
  assert.equal(param.findings, 5);
  assert.equal(param.tools_flipped, null);
  const nul = fruits.find((f) => f.rule === "result-contains-null");
  assert.equal(nul.tools_flipped, 1, "only tool a fails on null alone");
  assert.ok(fruits.every((f) => typeof f.fix === "string" && f.fix.length > 10));
});

test("gaps ranks rules by sites and categories by pass rate, skipping empty ones", () => {
  const summary = {
    rules: { "result-writes": { findings: 3, sites: 2 }, "schema-shape": { findings: 0, sites: 0 }, "param-description-missing": { findings: 9, sites: 5 } },
    by_category: { Commerce: { sites: 5, tools_passed_pct: 40 }, Demos: { sites: 2, tools_passed_pct: 90 }, Travel: { sites: 1, tools_passed_pct: null } },
  };
  const g = gaps(rows, summary);
  assert.deepEqual(g.rules_by_sites.map((r) => r.rule), ["param-description-missing", "result-writes"]);
  assert.equal(g.weakest_categories[0].category, "Commerce");
  assert.equal(g.strongest_categories[0].category, "Demos");
  assert.equal(g.sites_without_act_tools_pct, 90);
  assert.equal(g.sites_with_single_tool_pct, 0);
  assert.equal(typeof g.unannotated_tools_pct, "number");
});

test("nextThings counts adoption per spec feature over sites with tools", () => {
  const n = nextThings(rows);
  assert.deepEqual(n.consequential_hint, { sites: 1, pct: 10 });
  assert.deepEqual(n.act_tools, { sites: 1, pct: 10 });
  assert.deepEqual(n.declarative_forms, { sites: 1, pct: 10 });
  assert.equal(n.cross_origin_exposure.sites, 0);
});

test("learnings has the five keys and a timestamp", () => {
  const l = learnings(rows, [], { rules: {}, by_category: {} });
  assert.deepEqual(Object.keys(l).sort(), ["baseline", "gaps", "generatedAt", "low_hanging_fruits", "next_things", "top_vs_rest"]);
});

test("sites on the legacy surface become a fruit that counts the hidden tools", () => {
  const withLegacy = [...rows, { host: "old.example", status: "no-tools", legacy_surface: 1, legacy_tools: 3, tools_seen: 0, tools_executed: 0, tools_passed: 0, tools_annotated: 0 }];
  const fruit = lowHangingFruits(withLegacy, []).find((f) => f.rule === "legacy-surface");
  assert.equal(fruit.sites, 1);
  assert.equal(fruit.findings, 3);
  assert.equal(fruit.tools_flipped, null);
  assert.match(fruit.fix, /document\.modelContext/);
});
