import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { leaksIn, queriesIn } from "../src/lib/privacy.mjs";

const problems = [];
let seen = 0;
const visit = (path) => {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) visit(join(path, name));
    return;
  }
  if (!/\.(json|csv|log|md)$/.test(path)) return;
  seen++;
  const text = readFileSync(path, "utf8");
  for (const leak of leaksIn(text)) problems.push(`${path}: ${leak}`);
  if (!path.endsWith(".json")) return;
  const record = JSON.parse(text);
  if (Array.isArray(record.pages)) for (const q of queriesIn(record)) problems.push(`${path}: query string in ${q}`);
};
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["data"];
for (const target of targets) if (existsSync(target)) visit(target);
for (const p of problems.slice(0, 40)) console.log(p);
console.log(`${problems.length} problems in ${seen} files`);
process.exitCode = problems.length ? 1 : 0;
