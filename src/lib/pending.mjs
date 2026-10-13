export function pendingHosts(directory, doneSet, optout) {
  const out = new Set(optout.map((h) => h.trim()).filter(Boolean));
  return directory.sites.map((s) => s.host).filter((h) => !doneSet.has(h) && !out.has(h));
}

export function errorFor(err, stderr, written) {
  if (err?.killed) return "timeout";
  if (err && !written) return String(stderr || err.message).slice(0, 500);
  return null;
}
