import { mkdirSync, writeFileSync } from "node:fs";
import { fetchDirectory } from "./lib/directory.mjs";

const dir = await fetchDirectory();
mkdirSync("data", { recursive: true });
writeFileSync("data/directory.json", JSON.stringify(dir, null, 2) + "\n");
console.log(`${dir.sites.length} of ${dir.total} live sites written to data/directory.json`);
