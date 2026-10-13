import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedCall, orFail, withBudget, within } from "../src/lib/bounded.mjs";

test("a call that answers in time passes through and carries the cancel limit", async () => {
  const seen = [];
  const call = boundedCall(async (name, args, options) => { seen.push(options); return { name, args }; }, 50);
  assert.deepEqual(await call("get_a", { q: 1 }), { name: "get_a", args: { q: 1 } });
  assert.deepEqual(seen, [{ cancelAfter: 50 }]);
});

test("a call that never answers fails at the limit and the tool's later calls are skipped", async () => {
  let started = 0;
  const call = boundedCall((name) => { started++; return name === "hang" ? new Promise(() => {}) : Promise.resolve("fine"); }, 30);
  await assert.rejects(call("hang", {}), /did not answer within 30 ms/);
  await assert.rejects(call("hang", { q: 2 }), /skipped/);
  assert.equal(started, 1);
  assert.equal(await call("other", {}), "fine");
});

test("a call that is cancelled at the limit counts as not answering", async () => {
  const call = boundedCall((name, args, { cancelAfter }) => new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool "${name}" was canceled`)), cancelAfter)), 30);
  await assert.rejects(call("slow", {}), /did not answer within 30 ms/);
  await assert.rejects(call("slow", {}), /skipped/);
});

test("a call that fails quickly keeps its own error and is tried again next time", async () => {
  let n = 0;
  const call = boundedCall(async () => { n++; throw new Error("Tool failed: bad input"); }, 30);
  await assert.rejects(call("t", {}), /bad input/);
  await assert.rejects(call("t", {}), /bad input/);
  assert.equal(n, 2);
});

test("a call after the host's deadline is refused without starting", async () => {
  let started = 0;
  const call = withBudget(async () => { started++; return "ran"; }, 1000, () => 2000);
  await assert.rejects(call("get_a", {}), /^Error: budget: /);
  assert.equal(started, 0);
  assert.equal(await withBudget(async () => "ran", 3000, () => 2000)("get_a", {}), "ran");
});

test("within stops waiting at the limit and never throws", async () => {
  assert.equal(await within(new Promise(() => {}), 20), "timeout");
  assert.equal(await within(Promise.resolve(5), 20), "done");
  assert.equal(await within(Promise.reject(new Error("x")), 20), "failed");
});

test("orFail rejects with the label when the work overruns, and passes the value through otherwise", async () => {
  await assert.rejects(orFail(new Promise(() => {}), 20, "snapshot"), /snapshot did not finish within 20 ms/);
  assert.equal(await orFail(Promise.resolve(7), 20, "snapshot"), 7);
  await assert.rejects(orFail(Promise.reject(new Error("own")), 20, "snapshot"), /own/);
});
