import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { pendingHosts, errorFor } from "../src/lib/pending.mjs";

test("pendingHosts skips done hosts and opted-out hosts, keeps directory order", () => {
  const directory = { sites: [{ host: "a.example" }, { host: "b.example" }, { host: "c.example" }, { host: "d.example" }] };
  assert.deepEqual(pendingHosts(directory, new Set(["b.example"]), ["d.example", ""]), ["a.example", "c.example"]);
});

test("a run the pool killed is a timeout even when it wrote a file", () => {
  assert.equal(errorFor({ killed: true, message: "Command failed" }, "", true), "timeout");
  assert.equal(errorFor({ killed: false, message: "Command failed" }, "boom", false), "boom");
  assert.equal(errorFor({ killed: false, message: "Command failed" }, "", false), "Command failed");
  assert.equal(errorFor({ killed: false, message: "Command failed" }, "", true), null);
  assert.equal(errorFor(null, "", true), null);
});

test("an error from a crashed run carries no home path or IP address", () => {
  const error = errorFor({ killed: false, message: "Command failed" }, `Error at ${homedir()}/x.mjs: connect 10.1.2.3:443`, false);
  assert.ok(!error.includes(homedir()) && !error.includes("10.1.2.3"), error);
});
