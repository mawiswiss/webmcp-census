import { UA } from "./ua.mjs";

export async function fetchRobots(host, fetchFn = fetch) {
  try {
    const res = await fetchFn(`https://${host}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

function parse(text) {
  const groups = [];
  let group = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) { group = { agents: [], allow: [], disallow: [] }; groups.push(group); }
      group.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!group) continue;
    if (key === "disallow" && value) group.disallow.push(value);
    if (key === "allow" && value) group.allow.push(value);
  }
  return groups;
}

export function isAllowed(robotsTxt, path = "/", agent = "webmcp-census") {
  const groups = parse(robotsTxt);
  const group = groups.find((g) => g.agents.includes(agent.toLowerCase())) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  const longest = (rules) => rules.filter((r) => path.startsWith(r)).sort((a, b) => b.length - a.length)[0] ?? "";
  return longest(group.allow).length >= longest(group.disallow).length;
}
