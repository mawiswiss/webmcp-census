# WebMCP Census

Calls every read-only WebMCP tool on the sites listed in the webmcp.com directory and publishes what happens. Built on @swissspidy/webmcp-audit. Runs once a quarter.

## Reproduce

Needs Node 24 (see `.nvmrc`).

    npm install && npx playwright install chromium
    npm run fetch       # data/directory.json from the webmcp.com API
    npm run census      # data/raw/<host>.json, resumable, 4 hosts at a time
    npm run ora         # data/ora/<host>.json, cached Ora scores, 10 per minute
    npm run aggregate   # data/census.csv and data/summary.json
    npm test

## Method

Written in Task 9. Until then: homepage plus up to two listed pages per host, Chromium with WebMCP enabled, 1.5 s settle, only tools annotated read-only are called, results are never stored.

## Opting out

See OPTOUT.md.

## Licence

Code MIT. Everything under data/ is CC BY 4.0.
