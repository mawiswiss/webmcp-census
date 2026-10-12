import { createServer } from "node:http";
import { readFileSync } from "node:fs";

export function startFixtureServer() {
  const html = readFileSync(new URL("./broken-site/index.html", import.meta.url));
  const legacy = readFileSync(new URL("./broken-site/legacy.html", import.meta.url));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, ua: req.headers["user-agent"] ?? "" });
    if (req.url === "/robots.txt") { res.writeHead(404); return res.end(); }
    if (req.method === "POST") { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(req.url === "/legacy" ? legacy : html);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    requests,
    close: () => new Promise((r) => server.close(r)),
  })));
}
