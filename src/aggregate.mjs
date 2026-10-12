import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { summarizeSite, summarize, toCsv } from "./lib/aggregate.mjs";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const directory = read("data/directory.json");
const sites = new Map(directory.sites.map((s) => [s.host, s]));
const optout = new Set(existsSync("data/optout.txt") ? readFileSync("data/optout.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : []);
const rows = readdirSync("data/raw").filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((h) => !optout.has(h)).sort()
  .map((host) => summarizeSite(read(`data/raw/${host}.json`), sites.get(host), existsSync(`data/ora/${host}.json`) ? read(`data/ora/${host}.json`) : undefined));
const summary = summarize(rows);
writeFileSync("data/census.csv", toCsv(rows));
writeFileSync("data/summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ sites: summary.sites, tools: summary.tools, runs: summary.runs, sites_with_readonly_writes: summary.sites_with_readonly_writes }, null, 2));
