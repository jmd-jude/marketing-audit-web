# Connected Data Enrichment — GA4 & GSC Depth Pass

> **STATUS: SHIPPED.** All items in this doc are implemented. See `lib/gsc-ga4.ts` for fetch/format functions and `lib/agents.ts` for the conversion agent prompt update. This doc is retained as an implementation record.

## Background

The Connected tier (GA4 + GSC via OAuth) is live. The OAuth flow, session handling, `/api/connected-data` route, `lib/gsc-ga4.ts` fetch and format functions, and agent context injection pipeline are all shipped.

The current implementation pulls a narrow slice of what both APIs freely expose. This produces an audit that can feel thin or speculative in areas — particularly conversion optimization — because the underlying data to support evidence-based findings isn't being requested. This doc specifies what to add, where it goes in the code, and which agents receive it.

No new API scopes are required. Everything here is available within `analytics.readonly` and `webmasters.readonly`, which users have already granted.

---

## What to Add

### GA4

All additions use the same `analyticsData.properties.runReport` call pattern already in `fetchGa4Data()`. Add to the parallel `Promise.allSettled` array where possible to avoid adding latency.

**1. Conversions by channel**

- Dimensions: `sessionDefaultChannelGrouping`
- Metrics: `conversions`, `sessions`
- Order by: `conversions` desc
- Limit: 10 rows

Semantic context: shows how many conversion events (form submits, purchases, or any marked conversion) came from each traffic channel. Without this, the conversion agent has no basis for channel-level CRO recommendations. This is the highest-priority gap.

Add to `Ga4Data` interface:
```ts
conversionsByChannel: Array<{ channel: string; conversions: number; sessions: number; conversionRate: number }> | null
```

**2. Device category breakdown**

- Dimensions: `deviceCategory` (returns `mobile`, `desktop`, `tablet`)
- Metrics: `sessions`, `engagementRate`
- No limit needed (typically 3 rows)

Semantic context: mobile vs. desktop session split. Affects every UX, CRO, and content recommendation. A site getting 70% mobile traffic that isn't mobile-optimized is a critical finding; currently invisible.

Add to `Ga4Data` interface:
```ts
sessionsByDevice: Array<{ device: string; sessions: number; engagementRate: number }> | null
```

**3. Landing page performance (engagement quality per page)**

Replace or augment the current `topPages` report (sessions only) with engagement metrics per landing page.

- Dimensions: `landingPage`
- Metrics: `sessions`, `bounceRate`, `averageSessionDuration`
- Order by: `sessions` desc
- Limit: 10 rows

Semantic context: the current top-pages data tells you which pages get traffic but not whether that traffic is any good. A landing page with 500 sessions and 90% bounce rate needs a different recommendation than one with 500 sessions and 30% bounce rate.

Update `Ga4Data` interface — replace or extend `topPages`:
```ts
topPages: Array<{ page: string; sessions: number; bounceRate: number; avgSessionDuration: number }> | null
```

**4. Average engagement time (site-wide)**

- No dimensions (site-wide aggregate)
- Metrics: `averageSessionDuration`, `userEngagementDuration`
- Single-row report

Semantic context: time-on-site is one of the first things any client asks about and a standard benchmark metric for every digital audit. Currently absent.

Add to `Ga4Data` interface:
```ts
avgEngagementTime: number | null  // seconds
```

**5. Top events**

- Dimensions: `eventName`
- Metrics: `eventCount`
- Order by: `eventCount` desc
- Limit: 15 rows
- Exclude: `session_start`, `first_visit`, `page_view` (noise) — filter these out client-side after fetch

Semantic context: reveals analytics hygiene. A site with only auto-collected events has no conversion tracking set up. A site with custom events (form_submit, purchase, video_play) has measurable goals. The conversion agent should know the difference.

Add to `Ga4Data` interface:
```ts
topEvents: Array<{ event: string; count: number }> | null
```

---

### GSC

**6. Index coverage (wire up `indexSummary`)**

The `indexSummary` field is already in the `GscData` interface but always returns `null`. The GSC URL Inspection API is rate-limited for individual URLs, but the Coverage summary is accessible via sitemaps and the Search Console Coverage report endpoint.

Practical approach: use `webmasters.searchanalytics.query` with a date range and no dimension to get the aggregate indexed/not-indexed/error counts from the site's coverage report. Alternatively, call `sites.list` and `sitemaps.list` for submitted vs. indexed page counts.

Update `indexSummary` type in `GscData`:
```ts
indexSummary: { indexed: number; notIndexed: number; errors: number; warnings: number } | null
```

Semantic context: a site with 40% of pages excluded from Google's index has a structural SEO problem that outweighs everything else. This turns the technical agent's SEO section from ranking observations into site health findings.

**7. Query trend (week-over-week)**

Run the existing queries report twice: once for the most recent 30 days, once for the prior 30 days (31–60 days ago). Compute delta in total clicks and impressions between periods.

No new dimensions or fields — same `searchanalytics.query` call, different date range. Two additional API calls.

Add to `GscData` interface:
```ts
clickTrend: { recent30: number; prior30: number; delta: number } | null
impressionTrend: { recent30: number; prior30: number; delta: number } | null
```

Semantic context: flat 90-day aggregates can't tell you whether organic is growing or collapsing. A site with 10,000 impressions over 90 days looks different if 8,000 came in the first 30 days vs. the last 30. Direction is often the most important finding in a competitive landscape section.

---

## Formatter Updates (`formatGscContext`, `formatGa4Context`)

Each new data field needs to be rendered into the markdown context string. Follow the existing table format pattern. Suggested additions:

**GA4 formatter additions:**
- Conversions by channel table (channel | sessions | conversions | CVR%)
- Device breakdown table (device | sessions | engagement rate)
- Updated top pages table including bounce rate and avg session duration columns
- Site-wide avg engagement time as a scalar line
- Top events table — but only if non-trivial events exist. If the list is only auto-collected events, emit a note: "No custom conversion events detected — analytics tracking may be incomplete."

**GSC formatter additions:**
- Index coverage as a one-line summary ("X pages indexed, Y excluded, Z errors")
- Click trend as a scalar line ("Clicks: +12% vs. prior 30 days" or "Clicks: -8% vs. prior 30 days")

---

## Agent Routing

No changes to which agents receive which context streams. Existing routing stays:

- GSC context: `technical`, `strategy`, `competitive`, `content`
- GA4 context: all five agents

The enriched data flows automatically because agents receive the full formatted context string from `formatGscContext` / `formatGa4Context`. The only prompt tuning that may be worth doing after shipping this: update the `conversion` agent system prompt in `lib/agents.ts` to explicitly reference conversion rate by channel and events data when present. Currently the prompt is written to work with HTML only — it doesn't instruct the model to use GA4 conversion data.

---

## What This Does Not Include

- Geographic breakdown (country/region): available free, but low priority. Geo signals are useful for multilingual/multiregion sites but add noise for single-market SMBs. Add later.
- Exit pages: useful but redundant with landing page engagement for most audits.
- Audience demographics (age/gender): requires GA4 "Google signals" to be enabled — not reliable to assume it's on.
- Historical trend charts: the API supports it but rendering trend graphs in the UI is a separate UX workstream. The text-formatted trend deltas above (GSC click trend) are the right first step.

---

## Files to Modify

| File | Change |
|---|---|
| `lib/gsc-ga4.ts` | Add fields to `GscData` and `Ga4Data` interfaces; add new API calls in `fetchGa4Data` and `fetchGscData`; update `formatGscContext` and `formatGa4Context` |
| `lib/agents.ts` | Update `conversion` agent system prompt to reference conversion events and channel CVR when present |
| `app/api/connected-data/route.ts` | Verify response shape still matches — should be no changes needed if interfaces are updated cleanly |

No changes needed to the Edge audit route, the SSE pipeline, the session/auth flow, or the UI.

---

## Acceptance Criteria

A connected audit run after this work ships should produce context strings that include:

- GA4: conversion count and CVR by channel, device split, per-page bounce rate, avg engagement time, top custom events (or a note if none exist)
- GSC: index coverage summary, click trend direction vs. prior 30 days, top queries and pages (unchanged)

An auditor reviewing the output should not be able to say "we don't know if the site converts" or "we don't know what device their traffic is on." Those are currently true statements. After this work, they are not.
