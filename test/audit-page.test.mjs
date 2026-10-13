import { test } from "node:test";
import assert from "node:assert/strict";
import { addToolRuns, countBySeverity } from "../src/lib/audit-page.mjs";

const empty = () => ({ runs: [], findings: [], unfinished: [] });

test("a tool whose calls all ran keeps its runs and findings", () => {
  const smoke = empty();
  addToolRuns(smoke, "get_a", { runs: [{ tool: "get_a", ok: true }], findings: [{ ruleId: "result-slow", severity: "warning", tool: "get_a" }] });
  assert.equal(smoke.runs.length, 1);
  assert.equal(smoke.findings.length, 1);
  assert.deepEqual(smoke.unfinished, []);
});

test("a tool cut short by the budget is dropped whole and listed as unfinished", () => {
  const smoke = empty();
  addToolRuns(smoke, "get_b", {
    runs: [{ tool: "get_b", ok: true }, { tool: "get_b", ok: false, error: "budget: host time budget used up before \"get_b\"" }],
    findings: [{ ruleId: "result-error-on-valid-input", severity: "error", tool: "get_b" }],
  });
  assert.deepEqual(smoke.runs, []);
  assert.deepEqual(smoke.findings, []);
  assert.deepEqual(smoke.unfinished, ["get_b"]);
});

test("countBySeverity counts every severity, zero included", () => {
  assert.deepEqual(countBySeverity([{ severity: "error" }, { severity: "warning" }, { severity: "error" }]), { error: 2, warning: 1, info: 0 });
  assert.deepEqual(countBySeverity([]), { error: 0, warning: 0, info: 0 });
});
