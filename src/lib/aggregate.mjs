import { SMOKE_RULES, builtinRules, isReadOnlyTool } from "@swissspidy/webmcp-lint";
import { median, pct } from "./stats.mjs";

export const RULES = [...builtinRules.map((r) => r.id), ...Object.keys(SMOKE_RULES)].filter((id) => id !== "no-tools");
// A POST from a read-only tool fails nothing: RPC-style tool backends and MCP relays read over POST, see classifyWrite.
export const EXEC_FAIL = new Set(["result-error-on-valid-input", "result-contains-null", "result-not-serializable"]);
const MCP_RELAY = /\/(web)?mcp(\.php)?(\/rpc)?\/?$/i;
const ANALYTICS = /(\/g\/c$|\/collect$|\/cdn-cgi\/rum|monorail|beacon|telemetry|\/events?$|analytics|\/metrics|\/logs?$|\/ping$|csp-violations|\/usage\/?$|_log\.php$|\/monitoring$|\/_mintlify\/api\/v1\/e$)/i;

export function classifyWrite(url) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    path = String(url).split(/[?#]/)[0];
  }
  if (MCP_RELAY.test(path)) return "mcp";
  if (ANALYTICS.test(path)) return "analytics";
  return "other";
}
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

// The Q3 2026 run called a tool again on every page that listed it, so only its first page counts.
export function siteCalls(pages) {
  const firstPage = new Map();
  pages.forEach((p, i) => { for (const r of p.smoke?.runs ?? []) if (!firstPage.has(r.tool)) firstPage.set(r.tool, i); });
  const fromFirst = (i, tool) => !firstPage.has(tool) || firstPage.get(tool) === i;
  return {
    runs: pages.flatMap((p, i) => (p.smoke?.runs ?? []).filter((r) => fromFirst(i, r.tool))),
    findings: pages.flatMap((p, i) => (p.smoke?.findings ?? []).filter((f) => fromFirst(i, f.tool))),
  };
}

const uniqueFindings = (findings) => [...new Map(findings.map((f) => [[f.ruleId, f.tool, f.message].join("|"), f])).values()];

export function summarizeSite(raw, site = {}, ora) {
  const pages = (raw.pages ?? []).filter((p) => p.status === "ok");
  const tools = [...new Map(pages.flatMap((p) => p.snapshot?.tools ?? []).map((t) => [t.name, t])).values()];
  const { runs, findings: smokeFindings } = siteCalls(pages);
  const lintFindings = uniqueFindings(pages.flatMap((p) => p.lint?.findings ?? []));
  const all = [...lintFindings, ...smokeFindings];
  const executed = [...new Set(runs.map((r) => r.tool))];
  const validRuns = runs.filter((r) => r.kind !== "invalid");
  const failedTools = new Set(smokeFindings.filter((f) => EXEC_FAIL.has(f.ruleId)).map((f) => f.tool));
  const passed = executed.filter((t) => !failedTools.has(t) && validRuns.filter((r) => r.tool === t).every((r) => r.ok));
  const posts = runs.flatMap((r) => (r.writes ?? []).filter((w) => !w.crossOrigin).map((w) => ({ tool: r.tool, url: w.url })));
  const targets = (kind) => new Set(posts.filter((p) => classifyWrite(p.url) === kind).map((p) => stripTarget(p.url))).size;
  const params = tools.flatMap((t) => Object.values(t.inputSchema?.properties ?? {}));
  const described = params.filter((p) => typeof p?.description === "string" && p.description.length > 0).length;
  const dirTools = site.tools ?? [];
  const actTools = dirTools.filter((t) => t.kind === "act").length;
  const blank = (v) => (v === null ? "" : v);
  const row = {
    host: raw.host,
    category: site.category ?? "",
    directory_tools: site.toolCount ?? dirTools.length,
    api_surface: site.apiSurface ?? "",
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
    tools_unfinished: pages.reduce((n, p) => n + (p.smoke?.unfinished?.length ?? 0), 0),
    tools_executed: executed.length,
    tools_passed: passed.length,
    runs_valid: validRuns.length,
    runs_valid_ok: validRuns.filter((r) => r.ok).length,
    tools_posting: new Set(posts.map((p) => p.tool)).size,
    post_targets_mcp: targets("mcp"),
    post_targets_analytics: targets("analytics"),
    post_targets_other: targets("other"),
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
    sites: {
      total: rows.length,
      scanned: rows.length - by("skipped"),
      tools: by("tools"),
      no_tools: by("no-tools"),
      blocked: by("blocked"),
      error: by("error"),
      skipped: by("skipped"),
      with_calls: withTools.filter((r) => r.tools_executed > 0).length,
      nothing_to_call: withTools.filter((r) => r.tools_executed === 0).length,
    },
    directory_claimed_by_status: Object.fromEntries([...new Set(rows.map((r) => r.status))].map((st) => [st, sum(rows.filter((r) => r.status === st), "directory_tools")])),
    by_api_surface: rows.reduce((acc, r) => {
      if (!r.api_surface) return acc;
      (acc[r.api_surface] ??= {})[r.status] = (acc[r.api_surface][r.status] ?? 0) + 1;
      return acc;
    }, {}),
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
    sites_posting: {
      any: rows.filter((r) => r.tools_posting > 0).length,
      mcp: rows.filter((r) => r.post_targets_mcp > 0).length,
      analytics: rows.filter((r) => r.post_targets_analytics > 0).length,
      other: rows.filter((r) => r.post_targets_other > 0).length,
    },
    sites_legacy_surface: rows.filter((r) => r.legacy_surface === 1).length,
    sites_with_unfinished_tools: rows.filter((r) => r.tools_unfinished > 0).length,
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

function stripTarget(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(url).split(/[?#]/)[0];
  }
}
