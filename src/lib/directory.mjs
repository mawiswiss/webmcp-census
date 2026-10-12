import { UA } from "./ua.mjs";

const BASE = "https://webmcp.com/api/v1/sites";
const LIMIT = 500;

export async function fetchDirectory(fetchFn = fetch) {
  const sites = [];
  let total = Infinity;
  for (let offset = 0; offset < total; offset += LIMIT) {
    const res = await fetchFn(`${BASE}?type=live&limit=${LIMIT}&offset=${offset}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`directory ${res.status} at offset ${offset}`);
    const body = await res.json();
    total = body.total;
    sites.push(...body.sites);
    if (body.sites.length === 0) break;
  }
  return { fetchedAt: new Date().toISOString(), total, sites };
}

export function pagesFor(site) {
  const paths = new Set(["/"]);
  for (const tool of site.tools ?? []) if (tool.page) paths.add(tool.page);
  return [...paths].slice(0, 3).map((p) => new URL(p, site.url).href);
}
