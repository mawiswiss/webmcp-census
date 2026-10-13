import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { errorFor, needsRetry, pendingHosts, wasOffline } from "../src/lib/pending.mjs";

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

test("a host whose pages failed because this machine was offline is not a result", () => {
  const offlinePage = { url: "https://h.example/", status: "error", error: "page.goto: net::ERR_INTERNET_DISCONNECTED at https://h.example/" };
  assert.equal(wasOffline({ status: "ok", pages: [offlinePage] }), true);
  assert.equal(wasOffline({ status: "ok", pages: [{ ...offlinePage, error: "page.goto: net::ERR_NETWORK_CHANGED at https://h.example/" }] }), true);
  assert.equal(wasOffline({ status: "ok", pages: [{ ...offlinePage, error: "page.goto: net::ERR_NAME_NOT_RESOLVED at https://h.example/" }] }), false);
  assert.equal(wasOffline({ status: "ok", pages: [{ url: "https://h.example/", status: "ok" }], probe: { error: "page.goto: net::ERR_INTERNET_DISCONNECTED" } }), true);
  assert.equal(wasOffline({ status: "skipped", host: "h.example" }), false);
});

test("the retry pass takes a host whose every page failed, like one that failed outright", () => {
  assert.equal(needsRetry({ status: "error", host: "h.example", error: "timeout" }), true);
  assert.equal(needsRetry({ status: "ok", host: "h.example", pages: [{ url: "https://h.example/", status: "error", error: "page.goto: Timeout 30000ms exceeded." }] }), true);
  assert.equal(needsRetry({ status: "ok", host: "h.example", pages: [{ url: "https://h.example/", status: "ok", snapshot: { tools: [] } }] }), false);
  assert.equal(needsRetry({ status: "skipped", host: "h.example", reason: "robots" }), false);
});
