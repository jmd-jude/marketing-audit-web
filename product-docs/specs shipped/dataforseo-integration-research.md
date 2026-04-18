# DataForSEO Integration Research
## Marketing Intelligence App — Strategic Summary & Next Steps

**Date:** April 17, 2026  
**Context:** Research conversation exploring DataForSEO as a data enrichment layer for the Marketing Intelligence audit app

---

## What the App Is Today

A Next.js (App Router) audit tool that wraps 5 parallel Claude AI agents in a streaming SSE UI. Built as a "wizard of oz" pitch/demo tool for a boutique direct mail agency exploring digital service expansion or for SMB operators direct

**Current data pipeline:**
- HTML scrape + PageSpeed Insights (always-on, free)
- GA4 + Google Search Console via GCP service account (Connected tier, shipped)
- No third-party competitive or backlink data

**5 agents and weights:**
- Content & Messaging (25%)
- Conversion Optimization (20%)
- SEO & Technical (20%)
- Brand & Growth Strategy (20%)
- Competitive Positioning (15%) ← currently weakest; reasons from HTML alone

---

## What DataForSEO Is

An **API-first wholesale SEO data infrastructure provider** — the raw data layer that many SEO SaaS products are built on. Not an end-user tool; a B2B data API platform.

**Key characteristics:**
- Pay-per-use pricing model (no monthly subscription floor)
- Covers: SERP data, keyword research, backlinks, on-page analysis, domain analytics, reviews, business data, app store data, social media, and AI/LLM optimization data
- Used by Samsung, Adobe, HubSpot, Airbnb, Neil Patel Digital, and others
- Ukrainian-founded, Estonian-registered company
- Has a free sandbox for testing before any spend

---

## Strategic Conclusions

### 1. DataForSEO is the right abstraction layer for this app

The current data pipeline has first-party behavioral data (GA4/GSC) but zero third-party competitive signal. DataForSEO fills exactly that gap without requiring Ahrefs, SEMrush, or any other $150-250/month locked-in SaaS subscription.

### 2. Pay-per-use is a structural advantage at this stage

At the prototyping/pitching stage, monthly DataForSEO spend could be a few dollars vs. $150-250/month minimum for Ahrefs/SEMrush — whether you run one audit or a hundred. Cost scales with revenue rather than preceding it. This is the correct risk profile for a demo/pitch tool moving toward commercial product.

### 3. DataForSEO is not a replacement for GA4/GSC — it's complementary

First-party behavioral data (GA4/GSC) only comes from the client's own Google properties. DataForSEO provides third-party competitive intelligence. The ideal architecture uses both: DataForSEO for external competitive/SEO data, Google APIs for internal behavioral data.

### 4. DataForSEO vs. Ahrefs/SEMrush — the right mental model

Ahrefs and SEMrush are *applications* built on top of data infrastructure. DataForSEO is closer to the raw data layer those tools are built on. You're not buying a watered-down Ahrefs — you're buying access to the same category of underlying data, unpackaged, and assembling your own product logic (AI agents + prompts) on top. That's a more powerful and differentiated position.

### 5. Consolidation is good but not total

DataForSEO covers the majority of what's needed for website audit + competitive intelligence in one platform. The one meaningful gap is first-party behavioral data, which by definition only comes from the client's Google properties. No single third-party provider closes that gap — it's a feature, not a flaw.

### 6. The AI Optimization / LLM Mentions API is a bonus differentiator

DataForSEO recently launched an API for tracking how brands appear in LLM outputs (ChatGPT, Perplexity, etc.). For traditional direct mail / catalog marketers who are likely completely blind to their AI visibility, this could be a compelling 6th agent or an add-on audit dimension that no competitor currently offers.

---

## Proposed Integration Architecture

### New route: `/api/competitive-data`

Mirrors the existing `/api/connected-data` pattern exactly:
- Node runtime (not Edge — avoids the `googleapis` SDK constraint that necessitated the split in the first place)
- Called by `/api/audit` before launching agents, in parallel with `/api/connected-data`
- Returns formatted context strings: `{ labsContext, backlinksContext }`
- Fire-and-forget friendly — if DataForSEO is unavailable or returns an error, audit runs without it (same pattern as Connected tier graceful degradation)

### Three DataForSEO endpoints to call

All three use the **Live method** — instant results, no async task POST/GET polling required. This is important for compatibility with the SSE streaming architecture, but that architecture may get changed or reduced for a different GTM UX in the future. If async POST/GET is easier, let's discuss.

#### 1. Labs: `domain_rank_overview/live`
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live
```
**Input:** `{ target: "example.com", language_name: "English", location_code: 2840 }`

**Key fields to extract for agent context:**
- `metrics.organic.etv` — estimated monthly organic traffic
- `metrics.organic.count` — total keywords ranking
- `metrics.organic.pos_1` — keywords ranking #1
- `metrics.organic.pos_2_3`, `pos_4_10` — top-of-page presence
- `metrics.organic.is_up` / `is_down` / `is_lost` — ranking momentum signals
- `metrics.paid.count` + `estimated_paid_traffic_cost` — PPC activity signal
- `metrics.organic.estimated_paid_traffic_cost` — value of organic traffic in paid terms

**Routes to:** `technical` agent, `strategy` agent

#### 2. Labs: `competitors_domain/live`
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live
```
**Input:** `{ target: "example.com", language_name: "English", location_code: 2840, limit: 10, exclude_top_domains: true }`

**Key fields to extract (per competitor item):**
- `domain` — competitor domain
- `metrics.organic.etv` — their estimated traffic
- `metrics.organic.count` — their keyword count
- `metrics.organic.pos_1` through `pos_4_10` — their ranking strength
- `avg_position` — average SERP position across shared keywords
- `intersections` — number of keywords both domains compete for

**Routes to:** `competitive` agent (primary), `strategy` agent

#### 3. Backlinks: `summary/live`
```
POST https://api.dataforseo.com/v3/backlinks/summary/live
```
**Input:** `{ target: "example.com", backlinks_status_type: "live" }`

**Key fields to extract:**
- `rank` — domain authority score (0-1000 scale)
- `backlinks` — total backlink count
- `referring_domains` — unique referring domains
- `referring_main_domains` — unique root domains (cleaner authority signal)
- `backlinks_spam_score` — link profile health
- `broken_backlinks` — technical issue signal
- `broken_pages` — crawl health signal
- `info.cms` — CMS detection

**Routes to:** `technical` agent, `competitive` agent

### Agent routing summary

| Agent | Existing data | New DataForSEO data |
|---|---|---|
| content | GSC + GA4 | — |
| conversion | GA4 | — |
| technical | GSC | backlinks summary |
| strategy | GSC + GA4 | labs domain_rank_overview |
| competitive | HTML only | labs competitors_domain + backlinks summary |

---

## Tier Model Implication

DataForSEO maps cleanly onto the existing tier model and suggests a new tier:

| Tier | Data sources | Status |
|---|---|---|
| Standard | HTML + PageSpeed | Shipped |
| Connected | + GA4 + GSC | Shipped |
| **Professional** | **+ DataForSEO Labs + Backlinks** | **Roadmap** |
| Agency | + SEMrush/Ahrefs, Klaviyo, Meta Ads | Roadmap |

The "Professional" tier is now clearly defined with specific data sources and a per-audit cost model. DataForSEO's pay-per-use pricing means the Professional tier can be priced as an incremental per-audit charge or bundled into a retainer — either way, the cost structure scales with revenue.

---

## Important Implementation Notes

### Authentication
DataForSEO uses HTTP Basic Auth (base64 encoded `login:password`). Credentials come from the DataForSEO dashboard, not the account password.

```javascript
const cred = Buffer.from(`${login}:${password}`).toString('base64');
headers: { 'Authorization': `Basic ${cred}`, 'Content-Type': 'application/json' }
```

### Backlinks API requires separate activation
The Backlinks API has a separate pricing tier from Labs — it must be explicitly activated in the DataForSEO account dashboard before API calls will work. This is a Day 1 setup step. - *NOTE* - seeing now in dataforSEO that unlocking backlinks API requires a min commitment of $100. I'm not ready to make that yet, so if we have to deprioritize this for now while I'm still doing market research and testing, that's ok. Seems like we can still build the basic infrastructure that will leverage dataforSEO API's that we can in fact access and validate, THEN decide whether to add Backlinks and LLMs api for that matter.

### Sandbox environment available
DataForSEO offers a free sandbox for testing all endpoints before spending real credits. Use this for initial integration and eval work.

### Live endpoints only — no async polling needed
All three proposed endpoints use the `/live` suffix, meaning they return results synchronously in the POST response. No separate task ID + GET polling required. This is critical — async task management would be incompatible with the Edge SSE architecture.

### Cost amplification awareness
The same principle that applies to HTML truncation limits applies here: DataForSEO calls fire once per audit. At current scale this is trivial. At 1000 audits/month, cost per audit × volume = real money. Worth modeling before pricing the Professional tier.

---

## Recommended Next Steps for Claude Code Session

When picking this up in Claude Code with the full codebase as context, suggested work order:

1. **API credential setup** — Sign up for DataForSEO free trial, activate Backlinks API, get credentials into `.env.local` as `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`

2. **Sandbox validation** — Hit all three endpoints against a known domain (e.g. a current audit subject) in the sandbox environment. Capture real sample response JSON. This is the ground truth for what fields actually return and what values look like.

3. **Field selection refinement** — With real sample data in hand, decide exactly which fields from each response to include in `additionalContext` strings. Token budget per agent matters — don't pass everything, pass what's signal.

4. **Build `/api/competitive-data` route** — Mirror `/api/connected-data` structure. Three parallel DataForSEO calls via `Promise.allSettled`, graceful degradation if any call fails, returns `{ labsContext, backlinksContext }` strings.

5. **Wire into `/api/audit`** — Call `/api/competitive-data` in the pre-agent fetch block alongside `/api/connected-data`. Inject returned context strings into the appropriate agents via `additionalContext`.

6. **Update agent prompts in `lib/agents.ts`** — The competitive and technical agents will need prompt updates to know what DataForSEO data they're receiving and how to use it in scoring.

7. **Update `DataSourcesPanel`** — Add DataForSEO as a new data source tier in the UI. Add `connected` flag logic for when DataForSEO data was successfully returned.

8. **Roadmap / backlog update** — Add Professional tier definition, DataForSEO integration epic, and LLM Mentions API as a future 6th agent concept to `product-docs/ROADMAP.md`.

---

## Reference Links

- DataForSEO main site: https://dataforseo.com
- API documentation: https://docs.dataforseo.com/v3
- LLM-optimized doc index: https://docs.dataforseo.com/v3/llms.txt
- Labs API (Google): https://docs.dataforseo.com/v3/dataforseo_labs/google/overview.md
- Domain Rank Overview endpoint: https://docs.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live.md
- Competitors Domain endpoint: https://docs.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live.md
- Backlinks API overview: https://docs.dataforseo.com/v3/backlinks/overview.md
- Backlinks Summary endpoint: https://docs.dataforseo.com/v3/backlinks/summary/live.md
- Pricing: https://dataforseo.com/pricing
- Free sandbox: https://docs.dataforseo.com/v3/appendix/sandbox.md
- MCP server (for interactive research, not app integration): https://github.com/dataforseo/mcp-server-typescript
