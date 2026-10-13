import { readFileSync, writeFileSync } from "node:fs";

const summary = JSON.parse(readFileSync(new URL("../data/summary.json", import.meta.url), "utf8"));

const W = 720;
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n, unit = "") => (unit === "%" ? n.toFixed(1) : n.toLocaleString("en-GB"));
const niceTicks = (max) => {
  const step = [50, 100, 200, 250, 500, 1000].find((s) => max / s <= 4);
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
};

const style = `
  <style>
    .surface { fill: #fcfcfb; }
    .mark { fill: #2a78d6; }
    .dot { fill: #2a78d6; stroke: #fcfcfb; stroke-width: 2; }
    .grid { stroke: #e6e5e1; stroke-width: 1; }
    .ref { stroke: #52514e; stroke-width: 1; stroke-dasharray: 4 4; }
    .title { fill: #0b0b0b; font: 600 15px ${FONT}; }
    .label { fill: #0b0b0b; font: 13px ${FONT}; }
    .value { fill: #0b0b0b; font: 600 13px ${FONT}; font-variant-numeric: tabular-nums; }
    .muted { fill: #52514e; font: 12px ${FONT}; font-variant-numeric: tabular-nums; }
    @media (prefers-color-scheme: dark) {
      .surface { fill: #1a1a19; }
      .mark { fill: #3987e5; }
      .dot { fill: #3987e5; stroke: #1a1a19; }
      .grid { stroke: #333331; }
      .ref { stroke: #c3c2b7; }
      .title, .label, .value { fill: #ffffff; }
      .muted { fill: #c3c2b7; }
    }
  </style>`;

function svg(height, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-labelledby="t d">
  <title id="t">${esc(title)}</title>
  <desc id="d">${esc(desc)}</desc>${style}
  <rect class="surface" width="${W}" height="${height}" rx="8"/>
  <text class="title" x="24" y="32">${esc(title)}</text>
${body}
</svg>
`;
}

function hbar(x0, x1, y, h, r = 4) {
  const rr = Math.min(r, (x1 - x0) / 2, h / 2);
  if (x1 - x0 <= 0) return "";
  return `<path class="mark" d="M${x0},${y} H${x1 - rr} Q${x1},${y} ${x1},${y + rr} V${y + h - rr} Q${x1},${y + h} ${x1 - rr},${y + h} H${x0} Z"/>`;
}

function barChart({ file, title, desc, rows, max, ticks, unit, labelWidth }) {
  const x0 = 24 + labelWidth;
  const x1 = W - 80;
  const top = 64;
  const band = 30;
  const bar = 18;
  const height = top + rows.length * band + 40;
  const sx = (v) => x0 + ((x1 - x0) * v) / max;
  const grid = ticks
    .map((t) => `  <line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${top - 8}" y2="${top + rows.length * band}"/>\n  <text class="muted" x="${sx(t)}" y="${top + rows.length * band + 18}" text-anchor="middle">${fmt(t, unit === "%" ? "" : unit)}${unit}</text>`)
    .join("\n");
  const marks = rows
    .map((r, i) => {
      const y = top + i * band + (band - bar) / 2;
      return `  <text class="label" x="${x0 - 12}" y="${y + bar / 2 + 4}" text-anchor="end">${esc(r.label)}</text>
  ${hbar(x0, sx(r.value), y, bar)}
  <text class="value" x="${sx(r.value) + 8}" y="${y + bar / 2 + 4}">${fmt(r.value, unit)}${unit}</text>`;
    })
    .join("\n");
  writeFileSync(new URL(file, import.meta.url), svg(height, title, desc, `${grid}\n${marks}`));
}

const categories = Object.entries(summary.by_category)
  .map(([name, c]) => ({ label: `${name} (${c.sites} sites)`, value: c.tools_passed_pct }))
  .sort((a, b) => b.value - a.value);
barChart({
  file: "pass-rate.svg",
  title: "Executed read-only tools that pass, by category",
  desc: `Share of executed tools that passed every valid call, per directory category. All sites: ${summary.tools.passed_pct}%. Source: data/summary.json by_category.tools_passed_pct.`,
  rows: categories,
  max: 100,
  ticks: [0, 25, 50, 75, 100],
  unit: "%",
  labelWidth: 230,
});

const writeRules = new Set(["result-writes", "result-writes-cross-origin"]);
const findings = Object.entries(summary.rules)
  .filter(([id]) => !writeRules.has(id))
  .map(([id, r]) => ({ label: id, value: r.sites }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 12);
const findingsMax = Math.ceil(findings[0].value / 100) * 100;
const findingTicks = niceTicks(findingsMax);
barChart({
  file: "top-findings.svg",
  title: "Most common findings, by number of sites",
  desc: "The twelve lint and smoke findings that hit the most sites. POSTs from read-only tools are left out and covered in their own section. Source: data/summary.json rules.",
  rows: findings,
  max: findingsMax,
  ticks: findingTicks,
  unit: "",
  labelWidth: 230,
});

barChart({
  file: "annotations.svg",
  title: "Share of registered tools that declare each annotation",
  desc: `Out of ${summary.tools.seen.toLocaleString("en-GB")} tools seen. Source: data/summary.json tools.annotated_pct, readonly_pct, untrusted_pct, consequential_pct.`,
  rows: [
    { label: "any annotation", value: summary.tools.annotated_pct },
    { label: "readOnlyHint", value: summary.tools.readonly_pct },
    { label: "untrustedContentHint", value: summary.tools.untrusted_pct },
    { label: "consequentialHint", value: summary.tools.consequential_pct },
  ],
  max: 100,
  ticks: [0, 25, 50, 75, 100],
  unit: "%",
  labelWidth: 170,
});

{
  const grades = ["A+", "A", "B", "C", "D", "F"].filter((g) => summary.by_ora_grade[g]);
  const x0 = 80;
  const x1 = W - 40;
  const top = 64;
  const bottom = 300;
  const lo = 50;
  const hi = 90;
  const sy = (v) => bottom - ((bottom - top) * (v - lo)) / (hi - lo);
  const sx = (i) => x0 + ((x1 - x0) * (i + 0.5)) / grades.length;
  const all = summary.tools.passed_pct;
  const grid = [50, 60, 70, 80, 90]
    .map((t) => `  <line class="grid" x1="${x0}" x2="${x1}" y1="${sy(t)}" y2="${sy(t)}"/>\n  <text class="muted" x="${x0 - 10}" y="${sy(t) + 4}" text-anchor="end">${t}%</text>`)
    .join("\n");
  const ref = `  <line class="ref" x1="${x0}" x2="${x1}" y1="${sy(all)}" y2="${sy(all)}"/>\n  <text class="muted" x="${x1}" y="${sy(all) - 6}" text-anchor="end">all sites ${fmt(all, "%")}%</text>`;
  const dots = grades
    .map((g, i) => {
      const c = summary.by_ora_grade[g];
      const below = c.tools_passed_pct < all;
      return `  <circle class="dot" cx="${sx(i)}" cy="${sy(c.tools_passed_pct)}" r="6"/>
  <text class="value" x="${sx(i)}" y="${sy(c.tools_passed_pct) + (below ? 24 : -14)}" text-anchor="middle">${fmt(c.tools_passed_pct, "%")}%</text>
  <text class="label" x="${sx(i)}" y="${bottom + 24}" text-anchor="middle">${g}</text>
  <text class="muted" x="${sx(i)}" y="${bottom + 42}" text-anchor="middle">${c.sites} sites</text>`;
    })
    .join("\n");
  writeFileSync(
    new URL("ora-vs-execution.svg", import.meta.url),
    svg(bottom + 64, "Ora grade against the share of executed tools that pass", `Pass rate of executed read-only tools per Ora grade, for sites with tools and a cached Ora score. Source: data/summary.json by_ora_grade.`, `${grid}\n${ref}\n${dots}`),
  );
}

console.log("wrote pass-rate.svg, top-findings.svg, annotations.svg, ora-vs-execution.svg");
