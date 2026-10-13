import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchScore } from "./lib/ora.mjs";
import { scrubText } from "./lib/scrub.mjs";

const directory = JSON.parse(readFileSync("data/directory.json", "utf8"));
mkdirSync("data/ora", { recursive: true });
const hosts = directory.sites.map((s) => s.host).filter((h) => !existsSync(`data/ora/${h}.json`));
console.log(`${hosts.length} hosts without an Ora score`);
for (const [i, host] of hosts.entries()) {
  const r = await fetchScore(host);
  if (r.status === null || r.status === 429) {
    console.log(`${i + 1}/${hosts.length} ${host} not saved, next run retries: ${scrubText(r.error) ?? "rate limited"}`);
  } else {
    writeFileSync(`data/ora/${host}.json`, JSON.stringify(r, null, 2) + "\n");
    console.log(`${i + 1}/${hosts.length} ${host} ${r.status} ${r.score ?? "-"}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 6500));
}
