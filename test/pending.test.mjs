import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingHosts } from "../src/lib/pending.mjs";

test("pendingHosts skips done hosts and opted-out hosts, keeps directory order", () => {
  const directory = { sites: [{ host: "a.example" }, { host: "b.example" }, { host: "c.example" }, { host: "d.example" }] };
  assert.deepEqual(pendingHosts(directory, new Set(["b.example"]), ["d.example", ""]), ["a.example", "c.example"]);
});
