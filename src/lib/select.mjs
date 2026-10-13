import { isReadOnlyTool } from "@swissspidy/webmcp-lint";

const READ_VERBS = new Set(["get", "list", "search", "find", "read", "fetch", "lookup", "show", "view", "check", "count", "describe", "query", "browse", "about"]);
const SIDE_EFFECT_WORDS = new Set([
  "send", "mail", "email", "subscribe", "unsubscribe", "signup", "signin", "login", "logout", "register",
  "submit", "order", "pay", "payment", "checkout", "buy", "purchase", "add", "create", "update", "edit",
  "delete", "remove", "cancel", "reset", "upload", "share", "track", "record", "apply", "vote", "like", "follow",
  "book", "reserve", "contact", "post", "publish", "save", "write", "set", "toggle", "start", "stop",
]);

export function hasSideEffectWord(name) {
  const tokens = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (READ_VERBS.has(tokens[0])) return false;
  return tokens.some((t) => SIDE_EFFECT_WORDS.has(t));
}

export function selectTool(tool) {
  return isReadOnlyTool(tool) && !hasSideEffectWord(tool.name);
}

export function selectableIn(tools, allowed = selectTool) {
  return (tool) => allowed(tool) && tools.filter((other) => other.name === tool.name).every(allowed);
}
