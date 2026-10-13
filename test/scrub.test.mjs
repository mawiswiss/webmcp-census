import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { scrubText, stripQuery } from "../src/lib/scrub.mjs";

test("stripQuery keeps origin and path only", () => {
  assert.equal(stripQuery("https://www.google-analytics.com/g/collect?v=2&cid=123.456&tz=America%2FDenver#x"), "https://www.google-analytics.com/g/collect");
  assert.equal(stripQuery("not a url?x=1#y"), "not a url");
  assert.equal(stripQuery(undefined), undefined);
});

test("scrubText removes home paths, IP addresses and URL queries, and keeps times", () => {
  const raw = `Error at ${homedir()}/Repositories/x.mjs:3: connect ETIMEDOUT 64.239.123.129:443 - Local (10.235.61.229:50078), then ECONNREFUSED ::1:443 and fe80::1c2:3 calling https://a.example/p?tz=America%2FDenver at 03:32:03.760`;
  const out = scrubText(raw);
  assert.ok(!out.includes(homedir()), out);
  assert.ok(!/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(out), out);
  assert.ok(!out.includes("::1") && !out.includes("fe80"), out);
  assert.ok(out.includes("https://a.example/p") && !out.includes("tz="), out);
  assert.ok(out.includes("03:32:03.760"), "times stay");
  assert.equal(scrubText(undefined), undefined);
});
