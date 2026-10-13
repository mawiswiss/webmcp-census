# WebMCP Census

Calls the read-only WebMCP tools of the sites in the [webmcp.com](https://webmcp.com) directory and publishes what happens. Runs once a quarter. Built on [@swissspidy/webmcp-audit](https://www.npmjs.com/package/@swissspidy/webmcp-audit).

The Q3 2026 census covers the 2,964 live sites in the directory, audited on 13 October 2026. What came out of it, and how to use it for your own site or for research: [The WebMCP Census, Q3 2026: I called 3,842 website tools to see what works](https://marcwieland.name/webmcp-census-q3-2026/).

## The data

- `data/census.csv`: one row per site. [`data/COLUMNS.md`](data/COLUMNS.md) explains every column.
- `data/summary.json`: the totals, per category and per Ora grade.
- `data/learnings.json`: the typical site, the sites that pass every call against the rest, the gaps, the cheap fixes and how many sites use each part of the standard.
- `data/directory.json`: the directory snapshot the census ran on.
- `data/versions.json`: browser, engine, time limits and the run window.
- `plugin/skills/webmcp-readiness/SKILL.md`: the findings as a skill for coding agents.
- The raw records, one file per site, come with each [release](https://github.com/mawiswiss/webmcp-census/releases).

How the census measures, and where it falls short: [METHOD.md](METHOD.md).

## Install the skill

The skill gives a coding agent the census findings while it writes or reviews WebMCP tools. Three ways to add it:

1. Copy the file into your project, for Claude Code or any agent that reads skills from `.claude/skills/`:

       mkdir -p .claude/skills/webmcp-readiness && curl -fsSL https://raw.githubusercontent.com/mawiswiss/webmcp-census/main/plugin/skills/webmcp-readiness/SKILL.md -o .claude/skills/webmcp-readiness/SKILL.md

2. With the `skills` CLI. Untested until this repository is public:

       npx skills add mawiswiss/webmcp-census

3. As a Claude Code plugin:

       /plugin marketplace add mawiswiss/webmcp-census
       /plugin install webmcp-readiness@webmcp-census

## Reproduce

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

Code MIT. Everything under data/ is CC BY 4.0.
