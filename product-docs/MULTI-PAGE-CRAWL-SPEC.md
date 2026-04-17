# Multi-Page Crawl — Functional Spec

## What This Solves

The current audit analyzes the homepage only. The homepage is often the most generic page on a site — designed to reach everyone, it commits to no one. The pages that drive actual buying decisions (pricing, about, services, contact) are where the analysis would be most actionable. Without them, the conversion and strategy agents in particular are doing interpretation from inference rather than evidence.

Multi-page crawl fetches up to 3 interior pages per audit, routes each to the agents that benefit from it, and surfaces what was analyzed in the Data Inputs panel. No user behavior change required — it's invisible quality improvement.

---

## Pipeline Changes

### 1. Link Extraction (inside `fetchPageContent`)

Extract links from the raw HTML **before** script/style stripping, alongside the existing `extractPageMetadata` call. The raw HTML is already in memory at that point — no additional fetch required.

- Regex match all `href` attributes
- Resolve relative paths against the base URL
- Filter to same-origin, path-only links (exclude `#fragments`, external domains, file extensions like `.pdf`)
- Return as `links: string[]` added to the existing `{ content, metadata }` return shape

Nav links cover the majority of useful targets for the target persona (traditional marketers, catalog/DM clients). JS-rendered navs are not a meaningful concern for this audience.

### 2. Page Scoring and Selection

Score all extracted link candidates against a priority config (see below). Select the top 3 by score, skipping duplicates and zero-score URLs. Ties broken by order of appearance in the HTML.

This is a budget decision — fetch only pages likely to improve audit quality.

### 3. Interior Page Fetch

Fetch selected pages in parallel with `Promise.allSettled` and a 4-second timeout per page. On 404, timeout, or any error, that page simply doesn't contribute — no audit failure.

For each successful fetch:
- Strip scripts, styles, SVGs (same logic as homepage)
- Truncate to **3,000 chars** (vs 15k for homepage — interior pages need less context, cost less)
- Record status: `fetched | timeout | error | skipped`

### 4. Agent Routing

Each fetched page is appended to `additionalContext` for the agents assigned to its category. The technical agent intentionally receives no interior pages — its work is structural measurement (PageSpeed, schema, tracking), not interpretation.

Interior page content is injected as a clearly labeled section:

```
## Interior Page: /pricing
<stripped content>
```

---

## Page Config

A single config object drives both scoring (budget) and routing (relevance):

```ts
const PAGE_CONFIG: Array<{
  patterns: string[]   // substring matches against the URL path
  score: number        // priority for selection (higher = fetch first)
  agents: AgentKey[]   // which agents receive this page's content
}> = [
  {
    patterns: ['/pricing', '/plans', '/packages', '/rates', '/investment'],
    score: 10,
    agents: ['conversion', 'competitive'],
  },
  {
    patterns: ['/about', '/about-us', '/our-story', '/team', '/who-we-are'],
    score: 9,
    agents: ['strategy', 'content'],
  },
  {
    patterns: ['/services', '/solutions', '/products', '/offerings', '/what-we-do', '/work'],
    score: 9,
    agents: ['competitive', 'content', 'strategy'],
  },
  {
    patterns: ['/contact', '/demo', '/book', '/get-started', '/schedule', '/consultation'],
    score: 7,
    agents: ['conversion'],
  },
  {
    patterns: ['/how-it-works', '/process', '/approach', '/methodology'],
    score: 6,
    agents: ['strategy', 'content'],
  },
  {
    patterns: ['/case-studies', '/portfolio', '/results', '/clients', '/success'],
    score: 5,
    agents: ['competitive', 'strategy'],
  },
  // Skip list — zero score, never fetched
  // /blog, /news, /press, /privacy, /terms, /legal, /login, /app, /dashboard
  // /wp-admin, /cdn, /assets, any URL with date pattern (/2024/, /2025/)
]
```

**Matching logic:** substring match on the URL path, lowercased. First match wins. URLs with no match and no skip-list hit are ignored (Option A — strict). Do not fetch unrecognized URLs; routing wrong content to an agent is worse than missing an unconventional URL.

**Known miss case:** creative/unconventional URL patterns (`/investment` instead of `/pricing`, `/our-method` instead of `/process`). These will simply not be fetched in v1. The audit runs on homepage + whatever matched. Acceptable for initial release — track miss rate in logs and extend the pattern list based on observed audits.

---

## Token Cost Impact

| | Current | With multi-page |
|---|---|---|
| Homepage HTML per agent | ~3,500 input tokens | unchanged |
| Interior page content (3 pages × 3k chars, routed to 4 agents) | 0 | ~+2,000 tokens per affected agent |
| Total incremental input tokens per audit | 0 | ~8,000 |
| Incremental cost at Sonnet pricing ($3/M) | $0 | ~$0.024 |

Cost impact is negligible. The constraint is fetch latency, not tokens.

---

## Latency Impact

Interior page fetches run in parallel with each other (after homepage fetch completes, before agents launch). Fetches have a 4-second timeout. In practice, same-domain interior pages on a server that already responded to the homepage request resolve in under 1 second. The additional wall-clock time before agents launch should be 1-2 seconds in the typical case, 4 seconds worst case.

The `fetched` SSE message already appears before agents launch — that's when the user sees "Launching 5 parallel agents..." The interior page fetches happen in this same window. No visible UX regression.

---

## Data / Logging

No schema migration required. The existing `payload JSONB` column in the `audits` table stores the full `writeAuditLog` payload. Add `pagesAnalyzed` to that payload:

```ts
pagesAnalyzed: [
  { url: '/pricing', status: 'fetched', chars: 2847, agents: ['conversion', 'competitive'] },
  { url: '/about',   status: 'fetched', chars: 3100, agents: ['strategy', 'content'] },
  { url: '/contact', status: 'timeout', chars: 0,    agents: [] },
]
```

Queryable via Postgres JSONB: `payload->'pagesAnalyzed'`.

Future: add `pages_analyzed` integer column for easy aggregate queries ("what % of audits fetched 2+ interior pages"). Not required to ship.

---

## SSE / UI Surface

Extend the `fetched` SSE event to include `pagesAnalyzed`:

```ts
send({
  type: 'fetched',
  message: `Page fetched + PageSpeed ✓ + 3 interior pages ✓. Launching 5 parallel agents...`,
  pageSpeed,
  metadata: pageMetadata,
  connected: isConnected,
  pagesAnalyzed: [{ url: '/pricing', status: 'fetched' }, ...],
})
```

The Data Inputs panel should surface: **"Pages analyzed: homepage, /pricing, /about, /services"** — visible proof of methodology. This is a product moment: it signals rigor without the user having to understand what it means technically.

---

## What Not to Do

- Do not fetch more than 3 interior pages. Each adds tokens across 4 agents simultaneously — costs amplify fast.
- Do not send interior pages to the technical agent. Its work (PageSpeed, schema, tracking detection) is homepage-specific.
- Do not block agent launch on interior page fetches if they're slow. If all three interior fetches exceed 4 seconds, launch agents with homepage content only.
- Do not route unrecognized URLs to agents as a permissive fallback. Skip them cleanly.

---

## Future: LLM-Based URL Categorization

The deterministic pattern matching will miss unconventional URL designs. A future revision could:

1. After link extraction, send all candidate URLs to a lightweight Haiku call: "Categorize these URLs into: pricing, about, services, contact, process, case-studies, skip"
2. Fire this in parallel with the PageSpeed + robots/sitemap fetch (not sequentially before agents)
3. Merge results with the deterministic config, with LLM categorization taking precedence on non-matches

Net additional latency: near zero if parallelized correctly. PageSpeed is typically the slowest pre-fetch (up to 30 seconds) — the Haiku categorization call resolves well before that.

Defer until v1 ships and observed miss rate from logs justifies the added complexity.
