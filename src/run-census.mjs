import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { errorFor, needsRetry, pendingHosts } from "./lib/pending.mjs";

const CONCURRENCY = Number(process.env.CENSUS_CONCURRENCY ?? 4);
const TIMEOUT_MS = Number(process.env.CENSUS_TIMEOUT_MS ?? 420_000);
const retryErrors = process.argv.includes("--retry-errors");

const directory = JSON.parse(readFileSync("data/directory.json", "utf8"));
mkdirSync("data/raw", { recursive: true });
const optout = existsSync("data/optout.txt") ? readFileSync("data/optout.txt", "utf8").split("\n") : [];
const done = new Set(readdirSync("data/raw").filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((h) => {
  if (!retryErrors) return true;
  return !needsRetry(JSON.parse(readFileSync(`data/raw/${h}.json`, "utf8")));
}));
const queue = pendingHosts(directory, done, optout);
if (process.env.CENSUS_LIMIT) queue.length = Math.min(queue.length, Number(process.env.CENSUS_LIMIT));
console.log(`${queue.length} hosts pending, ${done.size} done, concurrency ${CONCURRENCY}`);

const startedAt = Date.now();
let active = 0;
let finished = 0;

function next() {
  while (active < CONCURRENCY && queue.length) {
    const host = queue.shift();
    active++;
    const t0 = Date.now();
    execFile(process.execPath, ["src/audit-one.mjs", host], { timeout: TIMEOUT_MS, maxBuffer: 20_000_000 }, (err, stdout, stderr) => {
      const file = `data/raw/${host}.json`;
      const error = errorFor(err, stderr, existsSync(file));
      if (error) writeFileSync(file, JSON.stringify({ status: "error", host, error }, null, 2) + "\n");
      const status = JSON.parse(readFileSync(file, "utf8")).status;
      finished++;
      active--;
      const rate = finished / ((Date.now() - startedAt) / 60_000);
      console.log(`${String(finished).padStart(5)} ${status.padEnd(7)} ${host} ${Math.round((Date.now() - t0) / 1000)}s  ${rate.toFixed(1)}/min, ~${Math.round(queue.length / Math.max(rate, 0.1))} min left`);
      next();
    });
  }
}
next();
