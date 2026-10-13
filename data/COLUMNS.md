# census.csv columns

One row per site in the webmcp.com directory. A ratio with nothing to divide by is empty, never 0. Empty Ora cells mean Ora had no cached score.

## The site

| Column | Meaning |
| --- | --- |
| `host` | Host name as the directory lists it. |
| `category` | Directory category. |
| `directory_tools` | Tools the directory lists for the site. |
| `api_surface` | How the directory found the tools: `spec`, `polyfill` or `mixed`. |
| `directory_act_tools` | Tools the directory classes as acting rather than answering. |
| `directory_act_share` | `directory_act_tools` as a share of `directory_tools`, in %. |
| `status` | `tools`, `no-tools`, `blocked`, `error` or `skipped`. See [How sites are classified](../README.md#how-sites-are-classified). |
| `legacy_surface` | 1 when a site without visible tools registered them on its own `navigator.modelContext` object. |
| `legacy_tools` | Tools found on that object, when they could be counted. |

## The tools the browser saw

| Column | Meaning |
| --- | --- |
| `tools_seen` | Distinct tool names registered across the audited pages. |
| `tools_imperative` | Of those, registered from script rather than as a `<form toolname>`. |
| `tools_annotated` | Tools with any annotation. |
| `tools_readonly` | Tools declaring `readOnlyHint`. |
| `tools_consequential` | Tools declaring `consequentialHint`. |
| `tools_untrusted` | Tools declaring `untrustedContentHint`. |
| `tools_titled` | Tools with a `title`. |
| `tools_exposed` | Tools with an `exposedTo` list. |
| `desc_len_median` | Median description length in characters. |
| `params_total` | Input properties across all tools. |
| `params_described` | Of those, properties with a description. |
| `params_described_pct` | `params_described` as a share of `params_total`, in %. |

## The calls

| Column | Meaning |
| --- | --- |
| `tools_unfinished` | Read-only tools not reached before the host's 180 s budget ran out. |
| `tools_executed` | Read-only tools the census called. |
| `tools_passed` | Of those, tools where every valid call answered without an error, without `null` and with a serialisable result. |
| `runs_valid` | Calls made with inputs the tool's schema allows. |
| `runs_valid_ok` | Of those, calls that came back without an error. |
| `tools_posting` | Called tools that sent a POST or similar to the site's own origin while they ran. |
| `post_targets_mcp` | Distinct same-origin POST targets that look like an MCP relay. |
| `post_targets_analytics` | Distinct same-origin POST targets that look like analytics or telemetry. |
| `post_targets_other` | Distinct same-origin POST targets of any other kind. |

## Findings and the Ora score

| Column | Meaning |
| --- | --- |
| `lint_errors` | Lint findings of severity error. |
| `lint_warnings` | Lint findings of severity warning. |
| `ora_score` | Ora's cached score, 0 to 100. |
| `ora_grade` | Ora's cached grade. |
| `r_<rule>` | Findings for one rule of the audit engine, with dashes as underscores. `r_result_contains_null` counts `result-contains-null`. The rules are listed in the [playwright-webmcp README](https://github.com/swissspidy/playwright-webmcp#rules). |
