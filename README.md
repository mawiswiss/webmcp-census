# WebMCP Census

Does Chrome see the WebMCP tools that websites register, and do they work when an agent calls them? The WebMCP Census checks every site in the [webmcp.com](https://webmcp.com) directory once a quarter and publishes what it finds.

By [Marc Wieland](https://marcwieland.name), who writes about WebMCP, AI agents and the web. The full Q3 2026 report is on his blog: [The WebMCP Census, Q3 2026: I called 3,842 website tools to see what works](https://marcwieland.name/webmcp-census-q3-2026/).

Use it in two ways:

1. Research: the data is open, one row per site. See [The data](#the-data).
2. Better WebMCP tools: give the findings to your coding agent as a skill. See [Get started](#get-started).

## What the Q3 2026 census found

No stable browser ships WebMCP yet. Chrome's origin trial now runs to Chrome 162 without a shipping date, and Edge runs one too. So every site here is early, and some support is better than none.

- 2,964 sites are in the directory. 1,748 of them, 59% of the sites checked, showed tools Chrome could see. 933 showed none. About half of those use a polyfill that never hands over to Chrome's own WebMCP.
- 931 sites had tools labelled read-only that the census could call safely. 832 of them had at least one tool that worked on every call, and 455 had only tools that did.
- 3,842 tools were called. 69% worked on every call under the audit's strict rules. Most of the rest trip over a detail: a `null` in the answer, a made-up id the site does not know, a login, or an edge value. Counting those as working, about 85% work.
- Labels are thin. 39% of tools carry none, and only 1.2% say that they change something.
- Productivity and business tools work most often, 79%. Travel and events sites show tools most often, 73%, but their tools work least often, 59%. Commerce has the fewest sites where every tool works, 38%.
- [Ora](https://ora.ai) graded 766 of these sites. Sites with an A show tools to Chrome more often, but the grade says almost nothing about whether the tools work.

A finding is what an audit rule flags, not proof that an agent had a problem. [METHOD.md](METHOD.md) says which findings fail a tool.

## How the data was collected

- A script opened each site in Chrome 156 with WebMCP switched on: the homepage and up to two pages the directory lists tools on. It respects robots.txt.
- It called only tools labelled read-only (`readOnlyHint`) whose name has no risky word such as `send` or `delete`.
- The inputs come from each tool's own schema, through Pascal Birchler's [@swissspidy/webmcp-audit](https://www.npmjs.com/package/@swissspidy/webmcp-audit): one call with the required parameters, one with all of them, one per edge value such as an empty string, and up to six wrong inputs. Every call uses a different input. A tool got 3.5 calls with valid input on average, and a tool without parameters gets one.
- A tool passes when every valid call comes back without an error and without `null`.
- The first run called a tool again on every page that listed it. Those repeats are left out of the data, and the census now calls each tool once per site.
- No answers are stored.

Details and limits: [METHOD.md](METHOD.md).

## Get started

The skill gives your coding agent the WebMCP spec, the census findings and Pascal's checks while it writes or reviews tools. It treats the findings as things to watch, not as hard rules.

1. Install it.

   In Claude Code (recommended):

       /plugin marketplace add mawiswiss/webmcp-census
       /plugin install webmcp-readiness@webmcp-census

   In Cursor, Codex, GitHub Copilot, Gemini CLI and other agents, with the [skills CLI](https://github.com/vercel-labs/skills):

       npx skills add mawiswiss/webmcp-census

   Without any tool, copy the file into your project:

       mkdir -p .claude/skills/webmcp-readiness && curl -fsSL https://raw.githubusercontent.com/mawiswiss/webmcp-census/main/plugin/skills/webmcp-readiness/SKILL.md -o .claude/skills/webmcp-readiness/SKILL.md

2. Ask your agent: "Review the WebMCP tools in this project with the webmcp-readiness skill."

3. Check the result against a running site:

       npx @swissspidy/webmcp-audit https://staging.example --smoke

   The skill explains the audit's report, and how to add Pascal's ESLint rules and Playwright checks to your project.

## The data

- [`data/census.csv`](data/census.csv): one row per site. [`data/COLUMNS.md`](data/COLUMNS.md) explains every column.
- [`data/summary.json`](data/summary.json): the totals, per category and per Ora grade.
- [`data/learnings.json`](data/learnings.json): the typical site, the sites that pass every call against the rest, the most common findings with what to do about them, and how many sites use each part of the spec.
- [`data/versions.json`](data/versions.json): browser, engine, time limits and the run window.
- The raw records, one file per site, and the directory snapshot come with each [release](https://github.com/mawiswiss/webmcp-census/releases).

The data is CC BY 4.0. If you use it, credit "The WebMCP Census by Marc Wieland" and link [the report](https://marcwieland.name/webmcp-census-q3-2026/).

## Run the census yourself

Needs Node 24 (see `.nvmrc`).

    npm install && npx playwright install chromium
    npm run fetch       # data/directory.json from the webmcp.com API
    npm run census      # data/raw/<host>.json, resumable, 4 hosts at a time
    npm run census -- --retry-errors
    npm run ora         # data/ora/<host>.json, cached Ora scores, 10 per minute
    npm run aggregate   # data/census.csv, data/summary.json, data/learnings.json
    node scripts/privacy-check.mjs   # fails if anything of the machine running it is left in data/
    npm test

`CENSUS_DEBUG=1` prints the stages of each host audit.

## Opting out

See [OPTOUT.md](OPTOUT.md).

## Licence

Code MIT, data CC BY 4.0. Made by [Marc Wieland](https://marcwieland.name). More on WebMCP and AI agents on [his blog](https://marcwieland.name).
