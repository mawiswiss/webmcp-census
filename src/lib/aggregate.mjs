import { isReadOnlyTool } from "@swissspidy/webmcp-lint";
import { median, pct } from "./stats.mjs";

export const RULES = [
  "result-error-on-valid-input", "result-contains-null", "result-not-serializable", "result-undefined", "result-too-large", "result-slow",
  "result-accepts-invalid-input", "result-writes", "result-writes-cross-origin", "result-navigates", "untrusted-content-unmarked", "result-suspicious-content",
  "description-missing", "description-length", "param-description-missing", "param-description-length", "schema-shape", "schema-no-null-literals",
  "schema-depth", "schema-unsupported-keywords", "description-injection", "sensitive-params", "duplicate-tool-name", "tool-shadowing",
  "third-party-registration", "similar-descriptions", "too-many-tools", "naming-consistency", "capability-trifecta",
];
const EXEC_FAIL = new Set(["result-error-on-valid-input", "result-contains-null", "result-not-serializable", "result-writes"]);
const col = (id) => `r_${id.replace(/-/g, "_")}`;
const hint = (t, spec, cdp) => t.annotations?.[spec] === true || t.annotations?.[cdp] === true;

export function classify(raw) {
  if (raw.status === "skipped") return "skipped";
  const pages = raw.pages ?? [];
  if (raw.status === "error" || pages.length === 0 || pages.every((p) => p.status === "error")) return "error";
  if (pages.some((p) => (p.snapshot?.tools.length ?? 0) > 0)) return "tools";
  if (raw.probe?.blocked) return "blocked";
  return "no-tools";
}

export function summarizeSite(raw, site = {}, ora) {
  const pages = (raw.pages ?? []).filter((p) => p.status === "ok");
  const tools = [...new Map(pages.flatMap((p) => p.snapshot?.tools ?? []).map((t) => [t.name, t])).values()];
  const runs = pages.flatMap((p) => p.smoke?.runs ?? []);
  const lintFindings = pages.flatMap((p) => p.lint?.findings ?? []);
  const smokeFindings = pages.flatMap((p) => p.smoke?.findings ?? []);
  const all = [...lintFindings, ...smokeFindings];
  const executed = [...new Set(runs.map((r) => r.tool))];
  const validRuns = runs.filter((r) => r.kind !== "invalid");
  const failedTools = new Set(smokeFindings.filter((f) => EXEC_FAIL.has(f.ruleId)).map((f) => f.tool));
  const passed = executed.filter((t) => !failedTools.has(t) && validRuns.filter((r) => r.tool === t).every((r) => r.ok));
  const params = tools.flatMap((t) => Object.values(t.inputSchema?.properties ?? {}));
  const described = params.filter((p) => typeof p?.description === "string" && p.description.length > 0).length;
  const dirTools = site.tools ?? [];
  const actTools = dirTools.filter((t) => t.kind === "act").length;
  const blank = (v) => (v === null ? "" : v);
  const row = {
    host: raw.host,
    category: site.category ?? "",
    directory_tools: site.toolCount ?? dirTools.length,
    directory_act_tools: actTools,
    directory_act_share: blank(pct(actTools, dirTools.length)),
    status: classify(raw),
    legacy_surface: raw.probe?.legacy ? 1 : 0,
    legacy_tools: raw.probe?.legacy ? blank(raw.probe.legacyTools ?? null) : 0,
    tools_seen: tools.length,
    tools_imperative: tools.filter((t) => t.source !== "declarative").length,
    tools_annotated: tools.filter((t) => t.annotations && Object.keys(t.annotations).length > 0).length,
    tools_readonly: tools.filter((t) => isReadOnlyTool(t)).length,
    tools_consequential: tools.filter((t) => hint(t, "consequentialHint", "consequential")).length,
    tools_untrusted: tools.filter((t) => hint(t, "untrustedContentHint", "untrustedContent")).length,
    tools_titled: tools.filter((t) => typeof t.title === "string" && t.title.length > 0).length,
    tools_exposed: tools.filter((t) => Array.isArray(t.exposedTo) && t.exposedTo.length > 0).length,
    desc_len_median: blank(median(tools.map((t) => (t.description ?? "").length))),
    params_total: params.length,
    params_described: described,
    params_described_pct: blank(pct(described, params.length)),
    tools_executed: executed.length,
    tools_passed: passed.length,
    runs_valid: validRuns.length,
    runs_valid_ok: validRuns.filter((r) => r.ok).length,
    lint_errors: lintFindings.filter((f) => f.severity === "error").length,
    lint_warnings: lintFindings.filter((f) => f.severity === "warning").length,
    ora_score: typeof ora?.score === "number" ? ora.score : "",
    ora_grade: ora?.grade ?? "",
  };
  for (const id of RULES) row[col(id)] = all.filter((f) => f.ruleId === id).length;
  return row;
}

const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);

function groupStats(rows, key) {
  const groups = {};
  for (const r of rows) (groups[r[key]] ??= []).push(r);
  return Object.fromEntries(Object.entries(groups).sort().map(([k, list]) => [k, {
    sites: list.length,
    tools_seen: sum(list, "tools_seen"),
    tools_executed: sum(list, "tools_executed"),
    tools_passed_pct: pct(sum(list, "tools_passed"), sum(list, "tools_executed")),
    sites_with_readonly_writes: list.filter((r) => r.r_result_writes > 0).length,
  }]));
}

export function summarize(rows) {
  const by = (status) => rows.filter((r) => r.status === status).length;
  const withTools = rows.filter((r) => r.status === "tools");
  const seen = sum(withTools, "tools_seen");
  return {
    generatedAt: new Date().toISOString(),
    sites: { total: rows.length, scanned: rows.length - by("skipped"), tools: by("tools"), no_tools: by("no-tools"), blocked: by("blocked"), error: by("error"), skipped: by("skipped") },
    tools: {
      seen,
      directory_claimed: sum(withTools, "directory_tools"),
      imperative_pct: pct(sum(withTools, "tools_imperative"), seen),
      annotated_pct: pct(sum(withTools, "tools_annotated"), seen),
      readonly_pct: pct(sum(withTools, "tools_readonly"), seen),
      consequential_pct: pct(sum(withTools, "tools_consequential"), seen),
      untrusted_pct: pct(sum(withTools, "tools_untrusted"), seen),
      executed: sum(withTools, "tools_executed"),
      passed_pct: pct(sum(withTools, "tools_passed"), sum(withTools, "tools_executed")),
    },
    runs: { valid: sum(withTools, "runs_valid"), valid_ok_pct: pct(sum(withTools, "runs_valid_ok"), sum(withTools, "runs_valid")) },
    sites_with_lint_errors: withTools.filter((r) => r.lint_errors > 0).length,
    sites_with_readonly_writes: rows.filter((r) => r.r_result_writes > 0).length,
    sites_legacy_surface: rows.filter((r) => r.legacy_surface === 1).length,
    rules: Object.fromEntries(RULES.map((id) => [id, { findings: sum(rows, col(id)), sites: rows.filter((r) => r[col(id)] > 0).length }])),
    by_category: groupStats(withTools, "category"),
    by_ora_grade: groupStats(withTools.filter((r) => r.ora_grade !== ""), "ora_grade"),
  };
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}
