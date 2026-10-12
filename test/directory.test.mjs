import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDirectory, pagesFor } from "../src/lib/directory.mjs";

test("fetchDirectory pages through the API by offset until total is reached", async () => {
  const calls = [];
  const batches = [
    { total: 501, sites: Array.from({ length: 500 }, (_, i) => ({ host: `h${i}.example` })) },
    { total: 501, sites: [{ host: "h500.example" }] },
  ];
  const fetchFn = async (url) => { calls.push(url); return { ok: true, json: async () => batches.shift() }; };
  const dir = await fetchDirectory(fetchFn);
  assert.equal(dir.sites.length, 501);
  assert.equal(dir.total, 501);
  assert.match(calls[0], /type=live/);
  assert.match(calls[0], /limit=500/);
  assert.match(calls[1], /offset=500/);
  assert.ok(dir.fetchedAt);
});

test("pagesFor returns the homepage plus the distinct pages the tools live on, three at most", () => {
  const site = { url: "https://h.example/", tools: [
    { name: "a", page: "/" }, { name: "b", page: "/pricing" }, { name: "c", page: "/pricing" }, { name: "d", page: "/docs" }, { name: "e", page: "/app" },
  ] };
  assert.deepEqual(pagesFor(site), ["https://h.example/", "https://h.example/pricing", "https://h.example/docs"]);
  assert.deepEqual(pagesFor({ url: "https://h.example/", tools: [] }), ["https://h.example/"]);
});
