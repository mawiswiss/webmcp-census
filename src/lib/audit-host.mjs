import { readFileSync } from "node:fs";
import { CONTEXT_OPTIONS, auditPage } from "./audit-page.mjs";
import { scrubText } from "./scrub.mjs";
import { orFail, within } from "./bounded.mjs";
import { debug } from "./debug.mjs";
import { UA } from "./ua.mjs";
import { selectTool } from "./select.mjs";
import { isGraphqlRead } from "./ignore.mjs";
import { stripPage } from "./strip.mjs";

const versionOf = (pkg) => JSON.parse(readFileSync(new URL(`../../node_modules/${pkg}/package.json`, import.meta.url), "utf8")).version;
const AUDIT_VERSION = versionOf("@swissspidy/webmcp-audit");
const ENGINE_VERSION = versionOf("@swissspidy/playwright-webmcp");
const BLOCK_TITLE = /just a moment|attention required|access denied|captcha|verify you are human|forbidden/i;

export function launchArgs() {
  return ["--enable-features=WebMCP", `--user-agent=${UA}`];
}

export async function auditHost({ host, urls, browser, callLimitMs = 20_000, budgetMs = 180_000, loadTimeoutMs = 15_000, snapshotTimeoutMs = 20_000, probeTimeoutMs = 60_000 }) {
  const deadline = Date.now() + budgetMs;
  const called = new Set();
  const pages = [];
  for (const url of urls) {
    const result = await auditPage(browser, url, {
      settleMs: 1500,
      callLimitMs,
      loadTimeoutMs,
      snapshotTimeoutMs,
      deadline,
      called,
      smokeOptions: { tools: selectTool, maxDurationMs: 8000, ignoreRequests: isGraphqlRead },
    });
    pages.push(stripPage(result));
  }
  const sawTools = pages.some((p) => (p.snapshot?.tools.length ?? 0) > 0);
  debug("probe", !sawTools);
  const probe = sawTools ? null : await probePage(browser, urls[0], probeTimeoutMs);
  debug("probe done");
  return {
    host,
    auditedAt: new Date().toISOString(),
    versions: { chromium: browser.version(), audit: AUDIT_VERSION, engine: ENGINE_VERSION, callLimitMs, budgetMs, loadTimeoutMs },
    pages,
    probe,
  };
}

async function probePage(browser, url, timeoutMs) {
  const context = await browser.newContext(CONTEXT_OPTIONS);
  try {
    return await orFail(probeIn(context, url), timeoutMs, "probe");
  } catch (err) {
    return { status: null, title: null, blocked: false, error: scrubText(String(err?.message ?? err)) };
  } finally {
    await within(context.close(), 10_000);
  }
}

async function probeIn(context, url) {
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const title = await page.title();
  const surface = await page.evaluate(legacySurface);
  return { status: response?.status() ?? null, title, blocked: (response?.status() ?? 0) >= 400 || BLOCK_TITLE.test(title), ...surface };
}

// Chromium 156 has no native navigator.modelContext, so a plain object there is a page's own stand-in that no agent reads.
function legacySurface() {
  const mc = navigator.modelContext;
  if (!mc || Object.prototype.toString.call(mc) !== "[object Object]") return { legacy: false, legacyTools: null };
  let legacyTools = null;
  try {
    if (typeof mc.listTools === "function") legacyTools = mc.listTools().length;
    else if (Array.isArray(mc.tools)) legacyTools = mc.tools.length;
  } catch {}
  return { legacy: true, legacyTools };
}
