import { classify } from "./aggregate.mjs";
import { scrubText } from "./scrub.mjs";

export function pendingHosts(directory, doneSet, optout) {
  const out = new Set(optout.map((h) => h.trim()).filter(Boolean));
  return directory.sites.map((s) => s.host).filter((h) => !doneSet.has(h) && !out.has(h));
}

export function errorFor(err, stderr, written) {
  if (err?.killed) return "timeout";
  if (err && !written) return scrubText(String(stderr || err.message)).slice(0, 500);
  return null;
}

const OFFLINE = /net::ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|NETWORK_ACCESS_DENIED)/;

export function wasOffline(raw) {
  return [...(raw.pages ?? []).map((p) => p.error), raw.probe?.error].some((e) => OFFLINE.test(e ?? ""));
}

export function needsRetry(raw) {
  return classify(raw) === "error";
}
