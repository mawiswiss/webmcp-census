import { scrubText, stripQuery } from "./scrub.mjs";

const scrubFindings = (findings) =>
  findings?.map((f) => ({
    ...f,
    ...(f.message !== undefined ? { message: scrubText(f.message) } : {}),
    ...(f.help !== undefined ? { help: scrubText(f.help) } : {}),
  }));

export function stripPage(page) {
  const out = { ...page };
  if (page.error !== undefined) out.error = scrubText(page.error);
  if (page.snapshot) {
    out.snapshot = {
      ...page.snapshot,
      url: stripQuery(page.snapshot.url),
      frames: page.snapshot.frames?.map((f) => ({ ...f, url: stripQuery(f.url), ...(f.error !== undefined ? { error: scrubText(f.error) } : {}) })),
      tools: page.snapshot.tools?.map((t) => (t.location ? { ...t, location: { ...t.location, url: stripQuery(t.location.url) } } : t)),
    };
  }
  if (page.lint) out.lint = { ...page.lint, findings: scrubFindings(page.lint.findings) };
  if (page.smoke) {
    out.smoke = {
      ...page.smoke,
      findings: scrubFindings(page.smoke.findings),
      runs: page.smoke.runs.map(({ result, args, ...run }) => ({
        ...run,
        ...(run.error !== undefined ? { error: scrubText(run.error) } : {}),
        ...(run.navigatedTo !== undefined ? { navigatedTo: stripQuery(run.navigatedTo) } : {}),
        ...(run.writes ? { writes: run.writes.map((w) => ({ ...w, url: stripQuery(w.url) })) } : {}),
      })),
      ...(page.smoke.aborted !== undefined ? { aborted: scrubText(page.smoke.aborted) } : {}),
    };
  }
  return out;
}

export function scrubRecord(raw) {
  const out = { ...raw };
  if (raw.error !== undefined) out.error = scrubText(raw.error);
  if (raw.probe) out.probe = { ...raw.probe, ...(raw.probe.error !== undefined ? { error: scrubText(raw.probe.error) } : {}) };
  if (raw.pages) out.pages = raw.pages.map(stripPage);
  return out;
}
