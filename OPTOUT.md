# Opting out

The census loads the pages listed for your site in the webmcp.com directory, reads the tools they register, and calls only the tools you annotated `readOnlyHint: true`, with inputs derived from your own schemas. It stores no tool results.

To be left out of the next run and removed from the published data, open an issue titled "opt-out: your-host.example" or email mail@marcwieland.name. The host goes into `data/optout.txt` and disappears from `census.csv` at the next aggregation. A `Disallow: /` for `webmcp-census` or `*` in your robots.txt is honoured without asking.
