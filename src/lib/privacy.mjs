import { homedir } from "node:os";

const PRIVATE_IP = /(?<![\d.])(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?![\d.])/;

export function machineMarkers() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const markers = [homedir()];
  if (zone && zone !== "UTC") markers.push(zone, encodeURIComponent(zone));
  return markers;
}

export function leaksIn(text, markers = machineMarkers()) {
  const found = markers.filter((m) => text.includes(m));
  if (/Local \((?!\[ip\])/.test(text)) found.push("local address");
  if (PRIVATE_IP.test(text)) found.push("private IP address");
  return found;
}

export function queriesIn(value, path = "", found = []) {
  if (Array.isArray(value)) {
    for (const item of value) queriesIn(item, `${path}[]`, found);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      const here = `${path}.${key}`;
      const isStoredUrl = (key === "url" || key === "navigatedTo") && here !== ".pages[].url";
      if (isStoredUrl && typeof v === "string" && /[?#]/.test(v)) {
        if (!found.includes(here)) found.push(here);
      } else {
        queriesIn(v, here, found);
      }
    }
  }
  return found;
}
