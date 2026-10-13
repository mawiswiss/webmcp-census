import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrubText } from "../src/lib/scrub.mjs";
import { scrubRecord } from "../src/lib/strip.mjs";

let changed = 0;
let seen = 0;
const visit = (path) => {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) visit(join(path, name));
    return;
  }
  if (!/\.(json|log)$/.test(path)) return;
  seen++;
  const before = readFileSync(path, "utf8");
  let after;
  if (path.endsWith(".log")) after = scrubText(before);
  else {
    const record = JSON.parse(before);
    const clean = Array.isArray(record.pages) || record.status !== undefined ? scrubRecord(record) : { ...record, ...(record.error !== undefined ? { error: scrubText(record.error) } : {}) };
    after = JSON.stringify(clean, null, 2) + "\n";
  }
  if (after !== before) {
    writeFileSync(path, after);
    changed++;
  }
};
for (const target of process.argv.slice(2)) visit(target);
console.log(`${changed} of ${seen} files scrubbed`);
