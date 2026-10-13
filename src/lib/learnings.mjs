import { EXEC_FAIL, siteCalls } from "./aggregate.mjs";
import { median, mean, pct } from "./stats.mjs";

const passRate = (r) => (r.tools_executed ? r.tools_passed / r.tools_executed : null);
const num = (v) => (typeof v === "number" ? v : null);

const TRAITS = {
  tools_seen: (r) => r.tools_seen,
  annotated_share: (r) => pct(r.tools_annotated, r.tools_seen),
  readonly_share: (r) => pct(r.tools_readonly, r.tools_seen),
  consequential_share: (r) => pct(r.tools_consequential, r.tools_seen),
  untrusted_share: (r) => pct(r.tools_untrusted, r.tools_seen),
  desc_len_median: (r) => num(r.desc_len_median),
  params_described_pct: (r) => num(r.params_described_pct),
  lint_errors_per_tool: (r) => (r.tools_seen ? Math.round((100 * r.lint_errors) / r.tools_seen) / 100 : null),
  act_share: (r) => num(r.directory_act_share),
};

const withTools = (rows) => rows.filter((r) => r.status === "tools");

export function baseline(rows) {
  const sites = withTools(rows);
  const out = { sites: sites.length };
  for (const [k, f] of Object.entries(TRAITS)) out[k] = median(sites.map(f));
  out.pass_rate_median = median(sites.map((r) => { const p = passRate(r); return p === null ? null : Math.round(1000 * p) / 10; }));
  return out;
}

export function topVsRest(rows) {
  const called = rows.filter((r) => r.tools_executed > 0);
  const top = called.filter((r) => r.tools_passed === r.tools_executed).sort((a, b) => b.tools_executed - a.tools_executed);
  const rest = called.filter((r) => r.tools_passed < r.tools_executed);
  const traits = {};
  for (const [k, f] of Object.entries(TRAITS)) traits[k] = { top: mean(top.map(f)), rest: mean(rest.map(f)) };
  traits.pass_rate = { top: mean(top.map(passRate)), rest: mean(rest.map(passRate)) };
  return {
    definition: "top: sites where every executed tool passed; rest: sites where at least one executed tool failed",
    top_sites: top.length,
    rest_sites: rest.length,
    top_hosts: top.map((r) => r.host),
    traits,
  };
}

const CHEAP = {
  "param-description-missing": "Add a description to every input property.",
  "description-length": "Write 20 to 600 characters that say what the tool does and when to call it.",
  "result-contains-null": "Where a tool can return null, leave the field out or return an empty value instead.",
  "result-undefined": "Return an object, even an empty one.",
  "result-string-json": "Return the object, not JSON inside a string.",
  "result-too-large": "Chrome recommends up to 1.5K characters per result, as a guideline. Keep answers concise with the most important data first, and page long lists instead of cutting data an agent needs.",
  "result-accepts-invalid-input": "Reject input that would give a wrong answer, with an error naming the valid values. Coerce harmless mismatches such as \"10\" for 10, and treat null as omitted.",
  "schema-unsupported-keywords": "Flatten $ref, oneOf, anyOf and allOf into plain object schemas.",
};
const col = (id) => `r_${id.replace(/-/g, "_")}`;

function toolsFlippedBy(raws, ruleId) {
  if (!EXEC_FAIL.has(ruleId)) return null;
  let flipped = 0;
  for (const raw of raws) {
    const byTool = new Map();
    for (const f of siteCalls((raw.pages ?? []).filter((p) => p.status === "ok")).findings) if (EXEC_FAIL.has(f.ruleId)) byTool.set(f.tool, (byTool.get(f.tool) ?? new Set()).add(f.ruleId));
    for (const rules of byTool.values()) if (rules.size === 1 && rules.has(ruleId)) flipped++;
  }
  return flipped;
}

export function lowHangingFruits(rows, raws) {
  const fruits = Object.entries(CHEAP).map(([rule, fix]) => ({
    rule,
    fix,
    sites: rows.filter((r) => (r[col(rule)] ?? 0) > 0).length,
    findings: rows.reduce((n, r) => n + (r[col(rule)] ?? 0), 0),
    tools_flipped: toolsFlippedBy(raws, rule),
  }));
  const sites = withTools(rows);
  fruits.push({
    rule: "annotations-missing",
    fix: "Declare readOnlyHint on every tool that only reads, and consequentialHint on every tool that acts.",
    sites: sites.filter((r) => r.tools_seen > r.tools_annotated).length,
    findings: sites.reduce((n, r) => n + (r.tools_seen - r.tools_annotated), 0),
    tools_flipped: null,
  });
  fruits.push({
    rule: "legacy-surface",
    fix: "Register on document.modelContext. Chrome 156 has no navigator.modelContext, so tools put there reach no agent.",
    sites: rows.filter((r) => r.legacy_surface === 1).length,
    findings: rows.reduce((n, r) => n + (Number(r.legacy_tools) || 0), 0),
    tools_flipped: null,
  });
  return fruits.sort((a, b) => b.sites - a.sites || b.findings - a.findings);
}

export function gaps(rows, summary) {
  const sites = withTools(rows);
  const categories = Object.entries(summary.by_category ?? {})
    .map(([category, s]) => ({ category, ...s }))
    .filter((c) => typeof c.tools_passed_pct === "number")
    .sort((a, b) => a.tools_passed_pct - b.tools_passed_pct);
  return {
    rules_by_sites: Object.entries(summary.rules ?? {}).map(([rule, s]) => ({ rule, ...s })).filter((s) => s.sites > 0).sort((a, b) => b.sites - a.sites).slice(0, 15),
    unannotated_tools_pct: pct(sites.reduce((n, r) => n + (r.tools_seen - r.tools_annotated), 0), sites.reduce((n, r) => n + r.tools_seen, 0)),
    sites_without_act_tools_pct: pct(sites.filter((r) => r.directory_act_tools === 0).length, sites.length),
    sites_with_single_tool_pct: pct(sites.filter((r) => r.tools_seen === 1).length, sites.length),
    weakest_categories: categories.slice(0, 3),
    strongest_categories: categories.slice(-3).reverse(),
  };
}

export function nextThings(rows) {
  const sites = withTools(rows);
  const feature = (pred) => { const n = sites.filter(pred).length; return { sites: n, pct: pct(n, sites.length) }; };
  return {
    declarative_forms: feature((r) => r.tools_seen > r.tools_imperative),
    consequential_hint: feature((r) => r.tools_consequential > 0),
    untrusted_content_hint: feature((r) => r.tools_untrusted > 0),
    cross_origin_exposure: feature((r) => r.tools_exposed > 0),
    tool_titles: feature((r) => r.tools_titled > 0),
    act_tools: feature((r) => r.directory_act_tools > 0),
  };
}

const NOT_FOUND = /not\s*found|no (results|matches|data|items|product|record)|does not exist|doesn'?t exist|unknown (id|product|item)|404/i;
const NEEDS_LOGIN = /auth|login|log in|sign in|permission|forbidden|401|403|token|unauthori[sz]ed|api key/i;

export function failureCauses(rows, raws) {
  const by_cause = { null_only: 0, error_text_as_answer: 0, error_on_sample_input: 0, not_found_for_made_up_input: 0, edge_value_only: 0, needs_login: 0, other: 0 };
  for (const raw of raws) {
    const { runs, findings } = siteCalls((raw.pages ?? []).filter((p) => p.status === "ok"));
    const valid = runs.filter((r) => r.kind !== "invalid");
    const failing = findings.filter((f) => EXEC_FAIL.has(f.ruleId));
    for (const tool of new Set(runs.map((r) => r.tool))) {
      const bad = valid.filter((r) => r.tool === tool && !r.ok);
      const found = failing.filter((f) => f.tool === tool);
      if (!bad.length && !found.length) continue;
      const text = [...found.map((f) => f.message ?? ""), ...bad.map((r) => r.error ?? "")].join(" ");
      const onSample = bad.some((r) => r.kind === "valid-minimal" || r.kind === "valid-full");
      if (!bad.length && found.every((f) => f.ruleId === "result-contains-null")) by_cause.null_only++;
      else if (onSample && NOT_FOUND.test(text)) by_cause.not_found_for_made_up_input++;
      else if (onSample && NEEDS_LOGIN.test(text)) by_cause.needs_login++;
      else if (onSample) by_cause.error_on_sample_input++;
      else if (bad.length && found.every((f) => f.ruleId === "result-error-on-valid-input")) by_cause.edge_value_only++;
      else if (!bad.length) by_cause.error_text_as_answer++;
      else by_cause.other++;
    }
  }
  const executed = rows.reduce((n, r) => n + (r.tools_executed || 0), 0);
  const passed = rows.reduce((n, r) => n + (r.tools_passed || 0), 0);
  const lenient = passed + by_cause.null_only + by_cause.not_found_for_made_up_input + by_cause.edge_value_only + by_cause.needs_login;
  return {
    note: "Sorted by the error text, so a heuristic. not_found and needs_login only count failures on the plain sample input. The lenient rate counts null_only, not_found, edge_value_only and needs_login as working.",
    failing: Object.values(by_cause).reduce((a, b) => a + b, 0),
    by_cause,
    pass_pct_strict: pct(passed, executed),
    pass_pct_lenient: pct(lenient, executed),
  };
}

export function learnings(rows, raws, summary) {
  return {
    generatedAt: new Date().toISOString(),
    baseline: baseline(rows),
    top_vs_rest: topVsRest(rows),
    gaps: gaps(rows, summary),
    low_hanging_fruits: lowHangingFruits(rows, raws),
    next_things: nextThings(rows),
    failure_causes: failureCauses(rows, raws),
  };
}
