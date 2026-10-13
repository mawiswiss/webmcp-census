import { homedir } from "node:os";

const HOME = homedir();
const URLS = /https?:\/\/[^\s"'`<>)\]]+/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g;
const IPV6 = /(?<![\w:.])[0-9a-f]*(?::[0-9a-f]*){2,}(?![\w:])/gi;

export function stripQuery(url) {
  if (typeof url !== "string") return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

export function scrubText(text) {
  if (typeof text !== "string") return text;
  return text
    .split(HOME).join("~")
    .replace(URLS, (m) => stripQuery(m))
    .replace(IPV4, "[ip]")
    .replace(IPV6, (m) => (m.includes("::") || m.split(":").length > 7 ? "[ip]" : m));
}
