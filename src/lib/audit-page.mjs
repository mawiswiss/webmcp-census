import { WebMCP, runSmoke, selectSmokeTools, watchPage } from "@swissspidy/playwright-webmcp";
import { lint, toContract } from "@swissspidy/webmcp-lint";
import { boundedCall, orFail, withBudget, within } from "./bounded.mjs";
import { debug } from "./debug.mjs";

// A fixed timezone and locale keep the machine's own settings away from the sites and out of the data.
export const CONTEXT_OPTIONS = { timezoneId: "UTC", locale: "en-US" };

export function addToolRuns(smoke, name, part) {
  if (part.runs.some((r) => /^budget:/.test(r.error ?? ""))) {
    smoke.unfinished.push(name);
    return;
  }
  smoke.runs.push(...part.runs);
  smoke.findings.push(...part.findings);
}

export function countBySeverity(findings) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

export async function auditPage(browser, url, { settleMs = 1500, callLimitMs = 20_000, loadTimeoutMs = 15_000, snapshotTimeoutMs = 20_000, deadline = Infinity, smokeOptions = {} } = {}) {
  debug("page", url);
  const context = await browser.newContext(CONTEXT_OPTIONS);
  const page = await context.newPage();
  debug("context ready");
  const webmcp = new WebMCP(page, undefined, { record: true, lint: {}, cdp: "auto" });
  try {
    await webmcp.install();
    const arrive = async (target) => {
      debug("goto", target);
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await within(page.waitForLoadState("load"), loadTimeoutMs);
      await page.waitForTimeout(settleMs);
      // settle() polls the page and overruns its own timeout when the page is busy.
      await within(webmcp.settle({ quietMs: Math.max(150, Math.min(settleMs, 1000)), timeoutMs: 5000 }), 10_000);
    };
    await arrive(url);
    debug("arrived", page.url());
    // snapshot() asks the browser over CDP without a timeout and waits forever on a page that stopped answering.
    const snapshot = await orFail(webmcp.snapshot(), snapshotTimeoutMs, "snapshot");
    debug("snapshot", snapshot.tools.length, "tools");
    let navigationRequested = false;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigationRequested = true;
    });
    // A tool that sets location.href returns before the page leaves, so wait for it or the next call takes the blame.
    const call = boundedCall(withBudget(async (name, args, options) => {
      const before = page.url();
      navigationRequested = false;
      try {
        return await webmcp.call(name, args, options);
      } finally {
        await page.waitForTimeout(100);
        if (navigationRequested && page.url() === before) {
          await page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame(), timeout: 5000 }).catch(() => {});
        }
      }
    }, deadline), callLimitMs);
    const home = page.url();
    const { selected, skipped } = selectSmokeTools(snapshot.tools, smokeOptions);
    const smoke = { runs: [], findings: [], counts: {}, skipped: skipped.map((t) => t.name), unfinished: [] };
    for (const [i, tool] of selected.entries()) {
      const left = () => selected.slice(i).map((t) => t.name);
      if (Date.now() > deadline) {
        smoke.unfinished.push(...left());
        break;
      }
      if (page.url() !== home) {
        try {
          await arrive(home);
        } catch (err) {
          smoke.aborted = `could not return to ${home}: ${String(err?.message ?? err).slice(0, 200)}`;
          smoke.unfinished.push(...left());
          break;
        }
      }
      debug("smoke", tool.name);
      const part = await runSmoke(snapshot.tools, call, { ...smokeOptions, tools: [tool.name] }, watchPage(page));
      addToolRuns(smoke, tool.name, part);
    }
    if (smoke.unfinished.length && !smoke.aborted) smoke.aborted = "time budget used up";
    smoke.counts = countBySeverity(smoke.findings);
    return {
      url,
      status: "ok",
      snapshot,
      contract: toContract(snapshot),
      lint: lint(snapshot, {}),
      smoke,
      api: snapshot.frames[0]?.api,
      cdp: Boolean(webmcp.cdp?.enabled),
    };
  } catch (err) {
    return { url, status: "error", error: String(err?.message ?? err) };
  } finally {
    debug("flush", await within(webmcp.flush(), 10_000));
    debug("close", await within(context.close(), 10_000));
  }
}
