# Data Pipelines Reference

This document covers the three external data pipelines that enrich audit context before agents run: DataForSEO, Google Search Console, and Google Analytics 4. For each, it documents the API calls made, every field retrieved, how data is transformed into agent-ready context, and which agents receive it.

---

## DataForSEO

**Source file:** `app/api/competitive-data/route.ts`  
**Called from:** `app/api/audit/route.ts` via `GET /api/competitive-data?siteUrl=...`  
**Auth:** HTTP Basic (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` base64-encoded)  
**Timeout:** 15 seconds per call  
**Runtime:** Node (not Edge — intentional parity with `/api/connected-data`)

Both endpoints below are called in parallel via `Promise.allSettled`. The `siteUrl` query param is parsed to extract the bare domain (www stripped).

---

### Endpoint 1: Domain Rank Overview

**API call:** `POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live`

**Parameters sent:**

| Parameter | Value |
|---|---|
| `target` | Bare domain (e.g. `example.com`, www stripped) |
| `language_name` | `English` |
| `location_code` | `2840` (United States) |

**Fields retrieved from response (`tasks[0].result[0].items[0].metrics`):**

| Field path | Description |
|---|---|
| `organic.pos_1` | Keywords ranking in position #1 |
| `organic.pos_2_3` | Keywords ranking in positions 2–3 |
| `organic.pos_4_10` | Keywords ranking in positions 4–10 |
| `organic.count` | Total keywords with any organic ranking |
| `organic.etv` | Estimated monthly organic traffic (visits) |
| `organic.estimated_paid_traffic_cost` | Estimated value of organic traffic ($/mo) |
| `organic.is_up` | Keywords trending upward since prior period |
| `organic.is_down` | Keywords trending downward |
| `organic.is_lost` | Keywords that dropped out of rankings |
| `paid.count` | Active paid keywords (0 = no PPC detected) |
| `paid.estimated_paid_traffic_cost` | Estimated monthly PPC spend |

**Transformation (`formatRankContext`):**

Raw numbers are formatted into a markdown table and returned as a single string (`rankContext`). Values are rounded and localized. Momentum fields (is_up/is_down/is_lost) are combined into a single "Ranking Momentum" row. The paid section is omitted if `paid.count` is 0.

---

### Endpoint 2: Competitors Domain

**API call:** `POST https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live`

**Parameters sent:**

| Parameter | Value |
|---|---|
| `target` | Bare domain |
| `language_name` | `English` |
| `location_code` | `2840` (United States) |
| `limit` | `10` |
| `exclude_top_domains` | `true` (filters out high-authority domains like Wikipedia) |

**Fields retrieved from response (`tasks[0].result[0].items[]`, top 10):**

| Field | Description |
|---|---|
| `domain` | Competitor domain |
| `avg_position` | Average SERP position across shared keywords |
| `intersections` | Number of keywords the target and competitor both rank for |
| `metrics.organic.etv` | Competitor's estimated monthly organic traffic |
| `metrics.organic.count` | Competitor's total ranking keywords |

**Transformation (`formatCompetitorsContext`):**

Top 10 competitors formatted into a markdown table (`competitorsContext`). All numeric values rounded and localized.

---

### Agent Distribution

| Context string | Agents that receive it |
|---|---|
| `rankContext` | `technical`, `strategy`, `competitive` |
| `competitorsContext` | `competitive`, `strategy`, `content` |

Both strings are injected into the agent's `additionalContext` parameter. If either API call fails or credentials are missing, that context string is `null` and silently omitted.

---

## Google Search Console

**Source file:** `lib/gsc-ga4.ts`  
**Called from:** `app/api/connected-data/route.ts` via `GET /api/connected-data?siteUrl=...`  
**Auth:** GCP service account (`GOOGLE_SERVICE_ACCOUNT_KEY`) with `webmasters.readonly` scope  
**Runtime:** Node (googleapis SDK incompatible with Edge)

---

### Property Resolution

Before any data is fetched, the pipeline resolves the canonical GSC site URL using `sites.list`. GSC properties can be domain-type (`sc-domain:example.com`) or URL-prefix (`https://www.example.com/`). The resolver prefers a domain property match, then falls back through URL prefix variants (exact, with www, without www). If no match is found, the pipeline returns `null` and the audit runs without GSC data.

---

### API Calls (all run in parallel via `Promise.allSettled`)

**API:** Google Search Console API v3 (`webmasters` / `searchanalytics`)

**Date ranges used:**
- Main range: last 90 days (for queries and pages)
- Recent 30: last 30 days (for trend)
- Prior 30: days 31–61 ago (for trend comparison)

---

**Call 1 — Top Queries**

`searchanalytics.query` with:
- Date range: 90-day main range
- Dimensions: `['query']`
- Row limit: 50

Fields extracted: `keys[0]` (query string), `clicks`, `impressions`, `ctr` (multiplied by 1000, divided by 10 → percentage with one decimal), `position` (multiplied by 10, divided by 10 → one decimal)

---

**Call 2 — Top Pages**

`searchanalytics.query` with:
- Date range: 90-day main range
- Dimensions: `['page']`
- Row limit: 20

Fields extracted: `keys[0]` (page URL), `clicks`

---

**Call 3 — Recent 30-day Trend**

`searchanalytics.query` with:
- Date range: last 30 days
- No dimensions (site-level aggregate)

Fields extracted: `clicks` and `impressions` summed across all rows

---

**Call 4 — Prior 30-day Trend**

`searchanalytics.query` with:
- Date range: days 31–61 ago
- No dimensions

Fields extracted: `clicks` and `impressions` summed across all rows

---

**Call 5 — Sitemaps**

`sitemaps.list` for the resolved site URL

Fields extracted from each sitemap's `contents[]`: `submitted` (integer), `indexed` (integer)

---

### Transformation (`fetchGscData` → `formatGscContext`)

`fetchGscData` assembles a `GscData` object:

| Property | Source |
|---|---|
| `topQueries` | Call 1 — array of {query, clicks, impressions, ctr, position} |
| `topPages` | Call 2 — array of {page, clicks} |
| `indexSummary` | Call 5 — {indexed, notIndexed, errors: 0, warnings: 0} |
| `clickTrend` | Calls 3 + 4 — {recent30, prior30, delta%} |
| `impressionTrend` | Calls 3 + 4 — {recent30, prior30, delta%} |

`formatGscContext` converts this to a markdown string (`gscContext`) with:
- Index coverage line (indexed vs. excluded pages)
- Click trend (30-day vs. prior 30, with delta %)
- Impression trend (30-day vs. prior 30, with delta %)
- Top 20 queries table (query, clicks, impressions, CTR, avg position)
- Top pages table (page URL, clicks)

---

### Agent Distribution

| Context | Agents that receive it |
|---|---|
| `gscContext` | `technical`, `strategy`, `competitive`, `content` |

---

## Google Analytics 4

**Source file:** `lib/gsc-ga4.ts`  
**Called from:** `app/api/connected-data/route.ts`  
**Auth:** Same GCP service account, `analytics.readonly` scope  
**Runtime:** Node

---

### Property Discovery

`discoverGa4PropertyId(domain)` runs before data is fetched. It calls `analyticsadmin.accountSummaries.list()` to enumerate all accessible GA4 properties, then for each property calls `properties.dataStreams.list()` to check the `webStreamData.defaultUri` against the target domain (www stripped, lowercased). The first match returns the numeric property ID. If no match is found, GA4 data is skipped.

---

### API Calls (all run in parallel via `Promise.allSettled`)

**API:** Google Analytics Data API v1beta (`analyticsdata.properties.runReport`)  
**Date range for all calls:** `90daysAgo` to `today`

---

**Report 1 — Sessions by Channel**

- Dimension: `sessionDefaultChannelGrouping`
- Metric: `sessions`
- Order: sessions descending

Fields: channel name, session count

---

**Report 2 — Top Landing Pages**

- Dimension: `landingPage`
- Metrics: `sessions`, `bounceRate`, `averageSessionDuration`
- Limit: 10
- Order: sessions descending

Fields: page path, sessions, bounce rate (×1000/10 → one decimal %), avg session duration (seconds, rounded)

---

**Report 3 — New vs Returning**

- Dimension: `newVsReturning`
- Metrics: `sessions`, `engagementRate`, `bounceRate`

Fields: dimension value (`new` or `returning`), sessions, engagement rate, bounce rate

This report also drives two derived site-wide metrics: `engagementRate` and `bounceRate` (weighted averages across new and returning session counts).

---

**Report 4 — Conversions by Channel**

- Dimension: `sessionDefaultChannelGrouping`
- Metrics: `conversions`, `sessions`
- Limit: 10
- Order: conversions descending

Fields: channel, conversions (rounded), sessions, `conversionRate` (computed as conversions/sessions × 10000/100)

Rows with 0 conversions are filtered out. If all rows are 0, a note is injected indicating conversion tracking may not be configured.

---

**Report 5 — Device Category**

- Dimension: `deviceCategory`
- Metrics: `sessions`, `engagementRate`

Fields: device category (desktop/mobile/tablet), sessions, engagement rate (×1000/10 → one decimal %)

---

**Report 6 — Site-wide Engagement Time**

- No dimensions
- Metrics: `averageSessionDuration`, `userEngagementDuration`

Fields: `averageSessionDuration` (first row, first metric — seconds, rounded). This becomes `avgEngagementTime` in the output.

---

**Report 7 — Top Events**

- Dimension: `eventName`
- Metric: `eventCount`
- Limit: 15
- Order: eventCount descending

Fields: event name, count

`session_start`, `first_visit`, and `page_view` are filtered out before passing to agents as they are noise. If all events are in the noisy set, a note is injected indicating custom tracking may be incomplete.

---

### Transformation (`fetchGa4Data` → `formatGa4Context`)

`fetchGa4Data` assembles a `Ga4Data` object:

| Property | Source |
|---|---|
| `sessionsByChannel` | Report 1 |
| `topPages` | Report 2 |
| `engagementRate` | Report 3 (weighted average) |
| `bounceRate` | Report 3 (weighted average) |
| `newVsReturning` | Report 3 |
| `conversionsByChannel` | Report 4 (0-conversion rows excluded) |
| `sessionsByDevice` | Report 5 |
| `avgEngagementTime` | Report 6 |
| `topEvents` | Report 7 (noisy events filtered) |

`formatGa4Context` converts this to a markdown string (`ga4Context`) with:
- Site-wide avg session duration (formatted as Xs or X.X min)
- Engagement rate and bounce rate
- New vs. returning % split
- Sessions by device table
- Sessions by channel table
- Conversions by channel table (or a "no conversions" note)
- Top landing pages table (page, sessions, bounce rate, avg duration)
- Top custom events table (or an "incomplete tracking" note)

---

### Agent Distribution

| Context | Agents that receive it |
|---|---|
| `ga4Context` | `technical`, `strategy`, `content`, `conversion` |

---

## How Context Reaches Agents

All three pipelines return formatted markdown strings. The audit route (`app/api/audit/route.ts`) assembles an `additionalContext` string per agent by concatenating whichever context strings that agent is configured to receive, separated by double newlines. This string is appended to the agent's user message after the page content. If a context string is `null` (credentials missing, property not found, API error), it is silently omitted — the audit continues at a lower data tier without failing.

The full routing table across all data sources:

| Agent | GSC | GA4 | DataForSEO rank | DataForSEO competitors | PageSpeed | Interior pages |
|---|---|---|---|---|---|---|
| `content` | Yes | Yes | No | Yes | No | Yes (pricing, about, services) |
| `conversion` | No | Yes | No | No | No | Yes (pricing, contact) |
| `technical` | Yes | Yes | Yes | No | Yes | No |
| `strategy` | Yes | Yes | Yes | Yes | No | Yes (about, services, case studies) |
| `competitive` | Yes | No | Yes | Yes | No | Yes (pricing, services, case studies) |
