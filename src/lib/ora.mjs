import { UA } from "./ua.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchScore(host, fetchFn = fetch, sleep = wait) {
  let error = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetchFn(`https://ora.ai/api/score/${host}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      error = String(err?.message ?? err);
      await sleep(5000);
      continue;
    }
    error = null;
    if (res.status === 429) { await sleep(Number(res.headers.get("retry-after") ?? 60) * 1000); continue; }
    if (!res.ok) return { host, score: null, grade: null, status: res.status };
    const body = await res.json();
    return { host, score: typeof body.score === "number" ? body.score : null, grade: body.grade ?? null, status: res.status };
  }
  return error ? { host, score: null, grade: null, status: null, error } : { host, score: null, grade: null, status: 429 };
}
