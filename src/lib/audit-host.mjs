import { readFileSync } from "node:fs";
import { audit } from "@swissspidy/webmcp-audit";
import { UA } from "./ua.mjs";
import { selectTool } from "./select.mjs";
import { stripPage } from "./strip.mjs";

const AUDIT_VERSION = JSON.parse(readFileSync(new URL("../../node_modules/@swissspidy/webmcp-audit/package.json", import.meta.url), "utf8")).version;
const BLOCK_TITLE = /just a moment|attention required|access denied|captcha|verify you are human|forbidden/i;

export function launchArgs() {
  return ["--enable-features=WebMCP", `--user-agent=${UA}`];
}

export async function auditHost({ host, urls, browser }) {
  const pages = [];
  for (const url of urls) {
    const report = await audit({
      url,
      crawl: false,
      maxPages: 1,
      smoke: true,
      settleMs: 1500,
      browser,
      smokeOptions: { tools: selectTool, maxDurationMs: 8000 },
    });
    pages.push(...report.pages.map(stripPage));
  }
  const sawTools = pages.some((p) => (p.snapshot?.tools.length ?? 0) > 0);
  const probe = sawTools ? null : await probePage(browser, urls[0]);
  return {
    host,
    auditedAt: new Date().toISOString(),
    versions: { chromium: browser.version(), audit: AUDIT_VERSION },
    pages,
    probe,
  };
}

async function probePage(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const title = await page.title();
    const surface = await page.evaluate(legacySurface);
    return { status: response?.status() ?? null, title, blocked: (response?.status() ?? 0) >= 400 || BLOCK_TITLE.test(title), ...surface };
  } catch (err) {
    return { status: null, title: null, blocked: false, error: String(err?.message ?? err) };
  } finally {
    await context.close();
  }
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
