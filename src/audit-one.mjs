import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { auditHost, launchArgs } from "./lib/audit-host.mjs";
import { pagesFor } from "./lib/directory.mjs";
import { fetchRobots, isAllowed } from "./lib/robots.mjs";

const host = process.argv[2];
const directory = JSON.parse(readFileSync("data/directory.json", "utf8"));
const site = directory.sites.find((s) => s.host === host);
if (!site) { console.error(`unknown host ${host}`); process.exit(2); }

mkdirSync("data/raw", { recursive: true });
const out = `data/raw/${host}.json`;
const write = (obj) => writeFileSync(out, JSON.stringify(obj, null, 2) + "\n");

if (!isAllowed(await fetchRobots(host), "/")) {
  write({ status: "skipped", host, reason: "robots" });
  process.exit(0);
}

const browser = await chromium.launch({ args: launchArgs(), executablePath: process.env.CENSUS_EXECUTABLE || undefined });
try {
  write({ status: "ok", ...(await auditHost({ host, urls: pagesFor(site), browser })) });
} finally {
  await browser.close();
}
