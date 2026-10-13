import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedUrls, fetchRobots, isAllowed } from "../src/lib/robots.mjs";

test("no robots.txt or no matching group allows", () => {
  assert.equal(isAllowed("", "/"), true);
  assert.equal(isAllowed("User-agent: Googlebot\nDisallow: /", "/"), true);
});

test("a wildcard group with Disallow: / blocks the census", () => {
  assert.equal(isAllowed("User-agent: *\nDisallow: /", "/"), false);
  assert.equal(isAllowed("User-agent: *\nDisallow: /admin", "/"), true);
});

test("a group naming the census wins over the wildcard, and the longest rule wins", () => {
  const txt = "User-agent: *\nDisallow: /\n\nUser-agent: webmcp-census\nDisallow: /private\nAllow: /";
  assert.equal(isAllowed(txt, "/"), true);
  assert.equal(isAllowed(txt, "/private/x"), false);
  assert.equal(isAllowed("User-agent: *\nDisallow: /\nAllow: /pricing", "/pricing"), true);
});

test("comments and blank Disallow lines are ignored", () => {
  assert.equal(isAllowed("# nothing\nUser-agent: *\nDisallow:\n", "/"), true);
});

test("fetchRobots returns the text, or an empty string on any failure", async () => {
  assert.equal(await fetchRobots("h.example", async () => ({ ok: true, text: async () => "User-agent: *\nDisallow: /" })), "User-agent: *\nDisallow: /");
  assert.equal(await fetchRobots("h.example", async () => ({ ok: false })), "");
  assert.equal(await fetchRobots("h.example", async () => { throw new Error("ECONNRESET"); }), "");
});

test("allowedUrls keeps only the pages robots.txt allows, query included", () => {
  const urls = ["https://h.example/", "https://h.example/app", "https://h.example/docs?tab=api"];
  assert.deepEqual(allowedUrls(urls, "User-agent: *\nDisallow: /app"), ["https://h.example/", "https://h.example/docs?tab=api"]);
  assert.deepEqual(allowedUrls(urls, "User-agent: *\nDisallow: /docs?tab="), ["https://h.example/", "https://h.example/app"]);
  assert.deepEqual(allowedUrls(urls, "User-agent: webmcp-census\nDisallow: /"), []);
  assert.deepEqual(allowedUrls(urls, ""), urls);
});
