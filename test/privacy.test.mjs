import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { leaksIn, queriesIn } from "../src/lib/privacy.mjs";

const markers = [homedir(), "America/Denver", "America%2FDenver"];

test("leaksIn names the machine markers and private addresses it finds", () => {
  assert.deepEqual(leaksIn(`at ${homedir()}/x.mjs`, markers), [homedir()]);
  assert.deepEqual(leaksIn("widget?timezone=America%2FDenver", markers), ["America%2FDenver"]);
  assert.deepEqual(leaksIn("connect 1.2.3.4 - Local (10.235.61.229:50078)", markers), ["local address", "private IP address"]);
  assert.deepEqual(leaksIn("connect [ip] - Local ([ip]:50078)", markers), [], "a scrubbed label is clean");
  assert.deepEqual(leaksIn("192.168.1.20 answered", markers), ["private IP address"]);
  assert.deepEqual(leaksIn("chromium 156.0.8078.4 at 03:32:03, 64.239.123.129 is public", markers), []);
});

test("queriesIn reports stored URLs that still carry a query, but not the requested page", () => {
  const raw = { pages: [{ url: "https://h.example/?lang=en", snapshot: { url: "https://h.example/", frames: [{ url: "https://w.example/w?tz=x" }] }, smoke: { runs: [{ navigatedTo: "https://h.example/n?s=1", writes: [{ url: "https://ga.example/c" }] }] } }] };
  assert.deepEqual(queriesIn(raw), [".pages[].snapshot.frames[].url", ".pages[].smoke.runs[].navigatedTo"]);
  assert.deepEqual(queriesIn({ pages: [{ url: "https://h.example/?a=1" }] }), []);
});
