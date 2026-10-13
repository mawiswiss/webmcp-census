import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { summarizeSite } from "../src/lib/aggregate.mjs";

const mode = process.argv[2];
if (mode === "start") {
  mkdirSync("data/raw-first", { recursive: true });
  const hosts = readdirSync("data/raw").filter((f) => f.endsWith(".json")).sort(() => Math.random() - 0.5).slice(0, 30);
  for (const f of hosts) renameSync(`data/raw/${f}`, `data/raw-first/${f}`);
  for (const f of hosts) execFileSync(process.execPath, ["src/audit-one.mjs", f.slice(0, -5)], { stdio: "inherit" });
}
let same = 0;
const diff = [];
for (const f of readdirSync("data/raw-first")) {
  const a = summarizeSite(JSON.parse(readFileSync(`data/raw-first/${f}`, "utf8")));
  const b = summarizeSite(JSON.parse(readFileSync(`data/raw/${f}`, "utf8")));
  if (a.tools_seen === b.tools_seen && a.tools_passed === b.tools_passed) same++;
  else diff.push({ host: a.host, seen_first: a.tools_seen, seen_again: b.tools_seen, passed_first: a.tools_passed, passed_again: b.tools_passed });
}
console.log(`${same} of ${same + diff.length} identical`);
console.table(diff);
