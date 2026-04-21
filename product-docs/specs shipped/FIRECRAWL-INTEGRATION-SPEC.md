# Firecrawl Integration — Functional Spec

https://docs.firecrawl.dev/llms.txt

## What This Solves

The audit currently fetches raw HTML and runs a strip pass before handing content to agents. Even after stripping scripts and styles, the remaining markup is noisy — deeply nested divs, tracking attributes, inline SVGs, framework boilerplate. Signal density is low. Agents spend attention parsing structural noise rather than analyzing marketing content.

More critically: JS-rendered sites (React, Next.js, Shopify) return near-empty HTML shells on raw fetch. The current approach produces unreliable output for modern stacks, which represent the growth segment of the target market.

Firecrawl is a purpose-built scraping API that handles JS rendering and returns clean markdown + structured metadata regardless of site stack. Integrating it replaces the current fetch-and-strip approach with a single API call per page, improves signal density for all sites, and unlocks reliable analysis for JS-rendered sites.

## What Changes

**Current flow:**
1. Raw `fetch()` of homepage URL
2. `fetchPageContent()` strips scripts/styles, truncates to 15k chars
3. `extractPageMetadata()` runs regex against raw HTML to pull title, meta, OG tags
4. Stripped HTML passed to agents as `additionalContext`

**Proposed flow:**
1. Firecrawl `/v2/scrape` call per page (homepage + interior pages)
2. Response: `{ markdown: string, metadata: { title, description, og:*, generator, ... } }`
3. Strip image markdown lines from body (`![...]()` regex — eliminates carousel/slider noise)
4. `metadata` object used directly for meta signals — no regex extraction needed
5. Cleaned markdown passed to agents as `additionalContext`

## Key Benefits

- **Signal density:** Clean markdown vs. stripped HTML. Agents receive copy, headings, CTAs, and structure — not tag soup.
- **Meta extraction:** `metadata` comes back as a structured object. Eliminates the current regex-based `extractPageMetadata()` pass entirely.
- **JS-rendered sites:** Firecrawl runs a headless browser, so React/Next.js/Shopify pages return full rendered content. Current approach returns near-empty shells for these.
- **Stack detection:** `metadata.generator` field reveals CMS/platform (e.g., "Wix.com Website Builder") — useful signal for the technical agent.
- **One solution, all stacks:** No need to build separate paths for server-rendered vs. JS-rendered sites.

## What to Keep

- Interior page routing logic (`PAGE_CONFIG` scoring, which agents receive which pages) — unchanged
- 4s timeout per interior page fetch — apply same timeout to Firecrawl calls
- `Promise.allSettled` pattern for interior pages — unchanged
- Character limits as a fallback: Firecrawl markdown will typically be smaller than stripped HTML, but truncation guard stays in place
- `pagesAnalyzed` tracking in SSE `fetched` event — unchanged

## Firecrawl Output Notes (from test on binger.com)

- Metadata object cleanly returns: title, description, OG tags, Twitter card, canonical URL, generator, language, viewport
- Body copy, headings (##/###), services, CTAs, and links all preserved accurately
- Primary noise: Wix carousels render as repeated `![Client Logos](...)` lines — same image URL repeated N times. One regex pass strips all image markdown before passing to agents.
- Wix site on binger.com confirmed JS-rendered; full content was returned correctly.

## API

Firecrawl v2 scrape endpoint:

```
POST https://api.firecrawl.dev/v2/scrape
Authorization: Bearer <FIRECRAWL_API_KEY>
{
  "url": "https://example.com",
  "formats": ["markdown"],
  "maxAge": 0
}
```

`formats` must be explicitly declared — the API has no default. `maxAge: 0` bypasses Firecrawl's 2-day cache, ensuring every audit reflects the current state of the page (a cached result from 2 days ago would be a silent correctness bug).

Response shape:
```json
{
  "success": true,
  "data": {
    "markdown": "...",
    "metadata": {
      "title": "...",
      "description": "...",
      "og:title": "...",
      "og:description": "...",
      "og:image": "...",
      "generator": "...",
      "language": "en",
      ...
    }
  }
}
```

Cost: 1 credit per page. At 4 pages per audit (homepage + 3 interior), Hobby plan ($19/month, 3,000 credits) supports ~750 audits/month.

## Environment Variable

| Variable | Notes |
|---|---|
| `FIRECRAWL_API_KEY` | Required for this feature. If unset, fall back to current fetch approach. |

## Edge Runtime Consideration

The audit route runs on Edge runtime (required for SSE). Firecrawl calls are plain `fetch()` — fully Edge-compatible. No Node.js dependency.

## Rollout Approach

1. Add `FIRECRAWL_API_KEY` to env and implement a `firecrawlFetch(url)` helper that calls the API and returns `{ markdown, metadata }`
2. Add image markdown strip pass: `markdown.replace(/!\[.*?\]\(.*?\)\n?/g, '')`
3. Replace `fetchPageContent()` calls in the audit route with `firecrawlFetch()`
4. Replace `extractPageMetadata()` with direct use of `metadata` object from Firecrawl response
5. If `FIRECRAWL_API_KEY` is unset, fall back to existing fetch path — zero regression risk during rollout

## Open Questions

- Does Firecrawl's markdown output preserve `<h1>`-level signals differently than `##` headings? Worth checking heading fidelity on a few real clients before going live.
- Interior page truncation limit (currently 3k chars): Firecrawl markdown is denser signal, so the limit may be raiseable without proportional token cost increase. Test before deciding.
- Self-hosted Firecrawl: AGPL-3.0 license means modifications must be open-sourced if run as a network service. Managed API is the right call at current stage.
- `formats: ["markdown", "links"]` returns a `links` array alongside markdown. Evaluate during implementation whether this can replace the current `extractLinks()` function used for interior page discovery — if so, removes a parsing step.
