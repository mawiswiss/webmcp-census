---
name: webmcp-readiness
description: "Use when adding, reviewing or fixing WebMCP tools on a website: document.modelContext.registerTool, declarative form tools (toolname), annotations such as readOnlyHint and consequentialHint, input schemas and tool results. Carries the WebMCP API as specified and as Chrome 156 implements it, what the WebMCP Census of 2,964 sites found that most sites get right and wrong, the quick wins, and how to check tools with Pascal Birchler's ESLint plugin, linter, Playwright fixture and audit."
---

# WebMCP readiness

By Marc Wieland (https://marcwieland.name), from the WebMCP Census, Q3 2026, run on 13th October 2026. The latest version of this skill lives at https://github.com/mawiswiss/webmcp-census/blob/main/plugin/skills/webmcp-readiness/SKILL.md, the data at https://github.com/mawiswiss/webmcp-census.

## How to use this skill

1. Get the API right first. The section "The WebMCP API" is the part that has to be correct.
2. Compare the tools with what the census found. Those are findings, not rules: what most sites get wrong and should watch, and what most get right and should keep.
3. Check with Pascal Birchler's tools, and read their warnings as questions.
4. Never make a working tool worse to clear a finding. Before changing a tool, ask whether an agent gets a better answer afterwards.
5. Install or configure tooling only when the user wants it. Ask before changing `package.json` or config files.

## The WebMCP API

As of the spec draft of 9th October 2026 (https://webmachinelearning.github.io/webmcp/) and Chrome 156.

### Where it lives and where it runs

- The API is `document.modelContext`, in secure contexts only (HTTPS or localhost). Chrome removed `navigator.modelContext` in Chrome 152. A polyfill must hand over to the native `document.modelContext` when it exists.
- No stable browser ships it yet. Chrome runs an origin trial from Chrome 149, extended to Chrome 162, with no shipping date. Edge runs its own origin trial. Firefox is neutral, Safari opposes it.
- To test locally, switch on `chrome://flags/#enable-webmcp-testing`. DevTools then lists the tools under Application, WebMCP, logs every call and runs a tool by hand.

### Registering a tool

```js
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "search_trips",
  title: "Search trips",
  description: "Find trips by country or city. Use it when the user asks where or when someone travelled.",
  inputSchema: {
    type: "object",
    properties: { place: { type: "string", description: "Country or city, for example Peru or Lima." } },
    required: ["place"],
  },
  annotations: { readOnlyHint: true },
  async execute({ place }, { signal }) {
    return { trips: await findTrips(place, { signal }) };
  },
}, { signal: controller.signal });

controller.abort();
```

- `name` is required: 1 to 128 characters from `A-Z a-z 0-9 _ - .`. `description` is required and must not be empty. `title` is optional and meant for browser UI. `inputSchema` is optional JSON Schema.
- `registerTool()` returns a promise. It rejects with `InvalidStateError` for a name already in use, an invalid name or an empty description.
- Aborting the signal unregisters the tool. `unregisterTool()`, `provideContext()` and `clearContext()` are gone, and there is no `updateTool()`: abort, then register again.
- `execute(input, { signal })` gets the parsed input. The signal aborts when the caller cancels.
- Return any value that survives JSON serialisation, usually an object. Chrome 156 turns objects into JSON and passes strings through as text. There is no `outputSchema` yet.
- When a call fails, throw an `Error`. A rejected promise reaches the agent as a failed call. An error message returned as a normal result looks like success.

### Annotations

All four default to false.

- `readOnlyHint`: the tool only reads. An agent can call it without asking.
- `consequentialHint`: the tool does something real or irreversible. The agent should confirm with the person first.
- `untrustedContentHint`: the result can contain text from users or third parties. The agent should treat it as data, not instructions.
- `debugging`: developer tooling. End-user agents can leave it out. Supported from Chrome 156.

### Declarative tools from forms

Chrome supports and documents this (https://developer.chrome.com/docs/ai/webmcp/declarative-api). The spec draft dropped it on 8th October 2026 and keeps it in the explainer, so treat it as Chrome's for now.

```html
<form toolname="search_products" tooldescription="Search the catalogue by keyword." toolautosubmit>
  <input name="q" toolparamdescription="Keyword, for example rain jacket.">
</form>
```

- `toolname` and `tooldescription` are both required. Without `toolautosubmit`, the person has to click submit.
- `toolparamdescription` describes a field. Without it, Chrome uses the label text.
- In the submit handler, `event.agentInvoked` is true for an agent's call. Call `event.preventDefault()`, then `event.respondWith(promise)` to send a result back.

### Frames and other origins

- Same-origin iframes can register tools. A cross-origin iframe needs `allow="tools"`, the Permissions Policy feature `tools`.
- `exposedTo: [origin]` in the register options shares a tool with other secure origins. Nobody in the census used it.

### Chrome's own guidance

Chrome recommends names up to 30 characters, descriptions up to 500, parameter descriptions up to 150, and tool output up to 1.5K characters (https://developer.chrome.com/docs/ai/webmcp/secure-tools). They are recommendations, not enforced, and Chrome says they may change.

## What the census found

The census loaded the 2,964 sites of the webmcp.com directory in Chrome 156 with WebMCP on. 1,748 showed tools Chrome could see. On 931 sites it called the 3,842 tools labelled read-only that had no risky word such as `send` in the name, 13,616 calls with valid input in total. Under the audit's strict rules, 68.7% of those tools worked on every call. Counting the ones that only stumble over a `null`, a made-up id, a login or an edge value, 84.6% work. The numbers come from [`summary.json`](https://github.com/mawiswiss/webmcp-census/blob/main/data/summary.json) and [`learnings.json`](https://github.com/mawiswiss/webmcp-census/blob/main/data/learnings.json).

These are findings: what most sites do. Use them as a list of things to keep and things to watch, not as rules.

### Keep doing

- Clean definitions. 98% of sites with tools have no lint errors, 95% use plain schemas, and almost none reuse a tool name.
- Small, focused tool sets. The median site has 4 tools. Sites where every call worked had about 5 tools, against 8 on sites where something failed.
- Descriptions of a useful length. The median site writes about 190 characters per description.
- Described parameters. Two thirds of sites describe every parameter.
- Labels on most tools. 61% of tools carry an annotation, and 43% are labelled read-only.
- Marked third-party text. 357 sites set `untrustedContentHint`.
- Working calls. 87% of the calls with valid input came back without an error.

### Watch out for

1. Tools Chrome cannot see. 933 sites showed none. About half use a polyfill that never hands over to Chrome, and 28 register on the old `navigator.modelContext`. Register at or soon after load, without a click or a login, and check the DevTools panel.
2. Missing labels. 39% of tools carry no annotation. Only 49 sites mark a tool as `consequentialHint`, while the directory counts tools that act on 919 sites.
3. Undescribed parameters on larger tool sets. 41% of all parameters lack a description, on 577 sites. The usual ones are ids, slugs, currencies and dates. Say the format and give an example: `"Arrival date as YYYY-MM-DD."`
4. Errors that look like answers. 332 tools return an error message as a normal result. Throw an `Error` instead.
5. `null` in results. 211 sites, and leaving it out would let 337 failing tools pass. The audit treats it as a failure because the Prompt API spec expects an object as a tool result. Fix it where the tool can really return `null`, for example a missing field. A guard for a value your code never sets to `null` adds nothing.
6. Third-party text next to tools that act. 482 sites return reviews, comments or search results on a page whose other tools act. Set `untrustedContentHint: true` on the tool that returns them.

Three more findings need judgement before you act on them.

Input the schema calls invalid, on 673 sites. This does not fail a tool, and it only hurts when the answer is wrong for that input. A filter value the tool ignores returns unfiltered results that look filtered. A `limit` of `"10"` read as 10 harms nobody. Reject input that would give a wrong answer, with an error naming the valid values. Coerce harmless mismatches, and treat `null` as omitted, because some clients send it to mean "leave this out".

```js
async execute({ status, limit }) {
  if (status != null && !STATUSES.includes(status)) throw new Error(`status must be one of: ${STATUSES.join(", ")}`);
  const n = limit == null ? 20 : Number(limit);
  if (!Number.isInteger(n) || n < 1) throw new Error("limit must be a whole number from 1");
  return search({ status: status ?? undefined, limit: n });
}
```

Results over 1,500 characters, on 569 sites. This does not fail a tool either. Chrome recommends up to 1.5K characters per result, so aim for concise answers, but a cut that drops what the agent needs is worse than a long answer. On one site that followed the budget strictly, listing 134 trips took 17 calls instead of one, and a yearly summary listed countries alphabetically and dropped the one with 92 days. Put the most important data first. Page long lists with a modest default, the total and a way to the next page. Never cut alphabetically, never hide items behind "and 14 more" without a way to fetch them, and do not stack a hard maximum on top of a character budget.

```js
async execute({ query, offset = 0, limit = 25 }) {
  const items = (await search(query)).sort((a, b) => b.relevance - a.relevance);
  const next = offset + limit < items.length ? offset + limit : undefined;
  return { items: items.slice(offset, offset + limit), total: items.length, nextOffset: next };
}
```

Errors on edge values. The audit also sends an empty string, the other enum values and the schema's minimum and maximum. 91 tools failed only on one of those. Declare the constraints that are true for the tool, such as `minLength: 1` when an empty query means nothing. Do not add constraints that are not true, like a `maxLength` on every string, only to steer the audit.

### Quick wins

Each takes minutes, and none needs a redesign.

1. Switch on the flag, open DevTools, Application, WebMCP, and check every tool is listed.
2. Label every tool: `readOnlyHint` or `consequentialHint`, and `untrustedContentHint` where it applies.
3. Describe every parameter with its format and an example.
4. Throw an `Error` when a call fails.
5. Leave out fields that would be `null`.
6. Give each tool a `title`.
7. Turn a search or contact form you already have into a declarative tool with `toolname` and `tooldescription`.

## Check with Pascal Birchler's tools

Pascal's packages share one rule set, `@swissspidy/webmcp-lint` (rules: https://github.com/swissspidy/playwright-webmcp/tree/main/docs/rules). Offer the one that fits, and install it only when the user agrees.

In the editor and on every ESLint run, checking `registerTool()` in the source:

```sh
npm install --save-dev @swissspidy/eslint-plugin-webmcp eslint
```

```js
// eslint.config.js
import webmcp from "@swissspidy/eslint-plugin-webmcp";
export default [webmcp.configs.recommended];
```

For tool definitions you already have as JSON:

```sh
npx @swissspidy/webmcp-lint tools.json --fail-on warning
```

In Playwright tests, against the browser's own WebMCP:

```sh
npm install --save-dev @swissspidy/playwright-webmcp @swissspidy/webmcp-lint @playwright/test
```

Pass `--enable-features=WebMCP` in `use.launchOptions.args` of `playwright.config`, import `test` and `expect` from `@swissspidy/playwright-webmcp`, and use the `webmcp` fixture: `toHaveTool`, `toPassLint`, `toPassSmoke`, `toMatchToolContract`.

Against a running site, staging included:

```sh
npm install --save-dev @swissspidy/webmcp-audit @playwright/test
npx playwright install chromium
npx @swissspidy/webmcp-audit https://staging.example --smoke --out .webmcp-audit
```

`--smoke` calls only tools labelled read-only. Useful options: `--fail-on warning`, `--baseline .webmcp-audit/report.json` to catch changed tools, `--header "Authorization: Bearer ..."` for a protected staging site, `--format github` for CI. In the library and the Playwright fixture, the smoke options `maxResultChars` and `maxDurationMs` set the budgets. Set them for the agents you target rather than bending a tool to fit the default.

Reading the report: three findings fail a tool, an error on valid input, `null` in the result and a result that cannot be serialised. The rest are warnings to weigh against what an agent needs.

## Checklist before a tool goes live

- Registered on `document.modelContext`, soon after load, without a click or a login, and listed in DevTools.
- Name of 1 to 128 characters from `A-Z a-z 0-9 _ . -`, ideally up to 30, in one naming style across the page.
- Description that says what the tool does and when to call it, ideally up to 500 characters.
- Every input property described with its format and an example. No `$ref`, `oneOf`, `anyOf` or `allOf`.
- `readOnlyHint: true` only if the tool changes nothing and does not navigate. `consequentialHint: true` on every tool that acts. `untrustedContentHint: true` when the result carries text written by users or third parties.
- Results are objects, without `null` where the tool can produce it, never JSON inside a string. Complete, with the most important data first. Long lists page with a modest default, the total and a way to the next page.
- Input that would give a wrong answer throws, with the valid values in the error. Harmless mismatches, such as `"10"` for 10 or `null` for an omitted field, are accepted.
- Failures throw an `Error`. Valid input returns in under 8 seconds.
- Checked with the audit or the Playwright fixture, and its warnings read as questions, not orders.
