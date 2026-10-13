---
name: webmcp-readiness
description: Use when registering, reviewing or fixing WebMCP tools (document.modelContext.registerTool, readOnlyHint, consequentialHint, inputSchema descriptions, tool results, declarative form tools). Carries what the Q3 2026 WebMCP Census found when it called every read-only tool on 2,964 directory sites: the baseline a typical site meets, what the best sites do differently, the failure modes that break agents most often with the fix for each, and a checklist to run before a tool goes live.
---

# WebMCP readiness, from the Q3 2026 census

The WebMCP Census loaded the 2,964 live sites of the webmcp.com directory in Chromium 156 with WebMCP enabled, on 13 October 2026, and called every tool annotated `readOnlyHint: true` with inputs derived from its own schema. 1,740 sites registered tools the browser could see, 9,095 tools in total. 3,827 tools were called, and 68.3% of them passed every valid call. The numbers below come from the census data files `summary.json` and `learnings.json`.

## Make the tools visible first

920 sites the directory lists with tools registered nothing Chromium could see. Before anything else, check that the browser sees the tools.

- Register on `document.modelContext`. Chrome 156 has no `navigator.modelContext`. A page that puts its own object there registers into nothing: 28 sites hid 135 tools that way.
- Of the 537 directory sites using a WebMCP polyfill, 453 showed no tools to native Chromium. A polyfill must hand over to the native `document.modelContext` when it exists.
- Register at or soon after page load, without needing a click or a login. The census waited 1.5 seconds after the load event, and tools that came later were not counted.

## The baseline a typical site meets

The median site with tools:

- registers 4 tools,
- annotates 71.4% of them, and declares a third read-only,
- writes descriptions of about 191 characters,
- describes every parameter,
- passes 87.5% of its executed tools.

A site below this is behind the median of sites that ship WebMCP at all.

## What the best sites do differently

Comparing the 93 sites where every called tool passed with the 834 others that had tools to call:

- More tools, each doing less: 10.4 tools against 6.1.
- More of them read-only: 83.6% against 73.0%.
- Shorter descriptions: a median of 209 characters against 297.
- Fewer tools that act: 22.3% against 31.2%.

Annotation and parameter descriptions were high in both groups (95.0% against 90.4%, and 88.9% against 83.6%). Treat this as a description of good sites, not a recipe: the top group is defined by its pass rate.

## Failure modes, most common first

### Annotations missing (954 sites, 3,511 tools)

An agent cannot tell whether a call is safe, so it either asks every time or asks never. Only 1.2% of tools declare `consequentialHint`, on 49 sites.

Before:

```js
document.modelContext.registerTool({ name: "get_order_status", description, inputSchema, execute });
```

After:

```js
document.modelContext.registerTool({ name: "get_order_status", description, inputSchema, annotations: { readOnlyHint: true }, execute });
document.modelContext.registerTool({ name: "cancel_order", description, inputSchema, annotations: { consequentialHint: true }, execute });
```

### Invalid input accepted (671 sites)

The tool answers a number where a string belongs, or a value outside its enum, as if nothing happened. The agent never learns it made a mistake.

```js
execute: async ({ limit }) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("limit must be an integer from 1 to 50");
  return search({ limit });
},
```

### Parameters without a description (573 sites, 9,766 parameters)

The most common ones are `hotelId`, `slug`, `currency` and check-in and check-out dates. The agent guesses the format.

Before: `checkIn: { type: "string" }`

After: `checkIn: { type: "string", format: "date", description: "Arrival date as YYYY-MM-DD." }`

### Results over 1,500 characters (567 sites)

Long results eat the agent's context. Return a page and a way to the next one.

```js
execute: async ({ query, offset = 0 }) => {
  const items = await search(query);
  return { items: items.slice(offset, offset + 10), total: items.length, nextOffset: offset + 10 < items.length ? offset + 10 : undefined };
},
```

### Errors on valid input (356 sites)

A schema-valid call throws or reports an error, for example because a backend is down or the schema allows inputs the backend refuses. Make the schema as strict as the backend, and test every tool with its own example inputs.

### `null` in results (210 sites)

Chrome's Prompt API rejects `null`, so the call fails on the agent's side although the site answered. Fixing this alone would flip 376 failing tools to passing.

Before: `return { name: product.name, price: product.price };`

After: `return { name: product.name, ...(product.price != null && { price: product.price }) };`

### Descriptions too short or too long (203 sites)

Write 20 to 600 characters that say what the tool does and when to call it.

### JSON returned as a string (173 sites)

Before: `return JSON.stringify(result);`

After: `return result;`

### Unsupported schema keywords (90 sites)

Flatten `$ref`, `oneOf`, `anyOf` and `allOf` into plain object schemas with `properties` and `required`.

### Third-party text next to tools that act (480 sites)

A tool that returns reviews, comments or search results from others sits on a page whose other tools act. Declare `untrustedContentHint: true` on it so an agent treats the result as data, not instructions. 28 sites had instruction-like text in tool descriptions, and 17 returned it in results without the hint.

## POST requests and readOnlyHint

195 sites have read-only tools that POST to their own origin. 46 of those post to an MCP relay, because JSON-RPC always posts, and 51 to analytics. A POST is not proof of a write, and nobody outside can verify `readOnlyHint`. Declare it only when the tool changes nothing, and keep the backend honest about it.

## What almost nobody ships yet

Share of the 1,740 sites with tools:

- `consequentialHint`: 2.8%. The next one to add, since agents need to know which acting tools to confirm with a person.
- Declarative `<form toolname>` tools: 15.2%. The cheapest WebMCP there is.
- `untrustedContentHint`: 20.4%.
- Tool titles: 24.4%.
- Cross-origin exposure with `exposedTo`: nobody yet.

## Checklist before a tool goes live

- Registered on `document.modelContext`, soon after load, without a click or login.
- Name of 1 to 128 characters from `A-Z a-z 0-9 _ . -`, in one naming style across the page.
- Description of 20 to 600 characters that says what the tool does and when to call it.
- Every input property has a description. No `$ref`, `oneOf`, `anyOf` or `allOf`.
- `readOnlyHint: true` only if the tool sends no POST, PUT, PATCH or DELETE that changes state and does not navigate. `consequentialHint: true` on every tool that acts.
- `untrustedContentHint: true` when the result carries text written by users or third parties.
- Results are objects, never `null` anywhere, never JSON inside a string, under 1,500 characters.
- Valid input returns in under 8 seconds. Invalid input throws.
- Tested from the outside: `npx @swissspidy/webmcp-audit https://staging.example --smoke`, or `npx lighthouse https://staging.example --only-categories=agentic-browsing`.
