# WebMCP Census: method

The corpus is the webmcp.com directory, read through its public API with `type=live`. The snapshot was fetched on 12 October 2026 and ships with the release as `data/directory.json`, next to the raw records. Every host in it gets one run. Exact versions and the run window are in `data/versions.json`.

## Pages and browser

Each host gets its homepage, plus up to two more pages the directory lists tools on. Three pages at most. The browser is Playwright's bundled Chromium with `--enable-features=WebMCP`, so no origin trial token is needed. It identifies itself as `webmcp-census/0.1 (+https://github.com/mawiswiss/webmcp-census)` and runs in UTC with the `en-US` locale. robots.txt is read first, for `webmcp-census` and for `*`. Every page is checked against it, and a host whose pages are all disallowed is skipped.

The census waits for the page's DOM, 30 s at most, then for the load event, 15 s at most. A page that never fires its load event is still audited. After that it waits 1.5 s, then until the tool list has held still for 1 s, ten seconds at most. Whatever is registered by then counts.

## What gets called

Only tools annotated `readOnlyHint: true`. Of those, a tool with a side-effect word in its name is left alone. The words: send, mail, email, subscribe, unsubscribe, signup, signin, login, logout, register, submit, order, pay, payment, checkout, buy, purchase, add, create, update, edit, delete, remove, cancel, reset, upload, share, track, record, apply, vote, like, follow, book, reserve, contact, post, publish, save, write, set, toggle, start, stop. A name that starts with a read verb is never excluded by its name: get, list, search, find, read, fetch, lookup, show, view, check, count, describe, query, browse, about. The inputs come from the tool's own `inputSchema` through the engine behind [@swissspidy/webmcp-audit](https://www.npmjs.com/package/@swissspidy/webmcp-audit): the required parameters only, all parameters, boundary values and invalid values. Nothing is invented.

Each tool's calls start from the original page. If an earlier tool navigated away, the page is loaded again first. A call gets 20 s. A tool that does not answer in time fails, and its remaining calls are skipped. After a call the census waits 100 ms for a navigation the tool started, so a tool that sets `location.href` is the one that gets the `result-navigates` finding. A host stops calling tools after 180 s. The tools it did not reach are listed as unfinished, not counted as failures.

## What gets judged

Every tool runs through the lint rules, and every call through the smoke rules, both listed in the [playwright-webmcp README](https://github.com/swissspidy/playwright-webmcp#rules). A tool passes when every valid call returned without an error and none of `result-error-on-valid-input`, `result-contains-null` or `result-not-serializable` fired for it.

While a read-only tool runs, the census records every request other than GET, HEAD and OPTIONS. One to the site's own origin is `result-writes`, one anywhere else `result-writes-cross-origin`, and that is mostly analytics. A POST that carries only GraphQL query documents is not recorded at all, because storefront APIs read that way.

A POST does not fail a tool. From the outside it proves nothing: MCP relays speak JSON-RPC, which always posts, and many tool backends take their arguments in a POST body. The census sorts same-origin POSTs by path into MCP relays, analytics beacons and other targets, and reports them on their own. The other targets are the upper bound for read-only tools that really write.

The census stores no tool results and no full call arguments. It keeps the tool definitions, the findings and the outcome of each call. A finding's message, capped at 500 characters, can name the generated input that triggered it, quote the tool's own error text, or quote the short piece of a result that tripped a rule. The inputs are built from each site's own schema, never from real data. URLs it records itself, such as request targets, frame addresses and navigation targets, keep their origin and path only, so the analytics identifiers and session tokens in their query strings never reach the data. Tool definitions stay exactly as the sites publish them.

## How sites are classified

- `tools`: the browser saw at least one tool.
- `no-tools`: the page loaded and registered nothing the browser could see.
- `blocked`: no tools, and the page answered 400 or higher, or showed a challenge page.
- `error`: every page failed to load or stopped answering, or the host ran past 420 s.
- `skipped`: robots.txt said no.

A host audited while the census machine itself was offline is not a result. It is recorded as an error and audited again in the retry pass.

A `no-tools` site whose page put its own object on `navigator.modelContext` is flagged `legacy_surface`. Chrome 156 has no `navigator.modelContext`, so tools registered there reach no agent.

## Ora cross-reference

Each host's cached score comes from `GET https://ora.ai/api/score/{host}`, which never triggers a scan. A host without a score stays empty in the data, never 0.

## Limits

Tools registered after the settle window, or only after a click or a login, are not seen. A page whose main thread stops answering is an error, even when it registered tools. A tool that needs more than 20 s fails, even if an agent would wait longer. Bot protection shows up as `blocked`, not as a site without tools. A read-only tool with a side-effect word in its name is not called, even when it is harmless. The directory decides the corpus, so a site that is not listed is not in the census. robots.txt was first checked for the homepage only, so four disallowed pages on four sites had been visited. They are removed from the data. Hosts whose every page failed got one more try, and 31 of 101 came back. A second audit of 30 random hosts matched the first on 28. One of the two others missed the page-load limit on the second visit, the other has a tool that passes only some of the time. The first hours of the run used the timezone of the machine running it, the rest ran in UTC. The query strings that carried it are removed from the data.
