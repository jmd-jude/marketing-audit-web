# Marketing Intelligence — System Architecture

---

## Current System (v1)

```
  URL + Auditor Name/Company
           │
           ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  DATA SOURCES  ·  Standard Tier  ·  no auth required        │
 │                                                             │
 │   Page HTML (15k chars)                                     │
 │   Google PageSpeed Insights  (Lighthouse 4-category)        │
 │   robots.txt + sitemap.xml                                  │
 └──────────────────────────┬──────────────────────────────────┘
                            │  parallel fetch (~2–5s)
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  ANALYSIS TEAM  ·  5 parallel Claude API calls              │
 │                                                             │
 │  Content & Messaging    25%   (headline, copy, CTAs)        │
 │  Conversion / CRO       20%   (friction, social proof)      │
 │  SEO & Technical        20%   (structure, perf, tracking)   │
 │  Brand & Growth         20%   (brand, channels, retention)  │
 │  Competitive            15%   (positioning, market gaps)    │
 │                                                             │
 │  → composite weighted score  ·  JSON output per agent       │
 └──────────────────────────┬──────────────────────────────────┘
                            │  streamed via SSE
                            ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  OUTPUTS                                                    │
 │                                                             │
 │  Real-time web UI     (score ring, agent cards, data panel) │
 │  Markdown report      (downloadable, client-ready)          │
 │  Discord log          (start ping + completion embed)       │
 └─────────────────────────────────────────────────────────────┘
```

**Runtime:** Vercel Edge Functions (SSE streaming requirement)
**Model:** Claude Haiku (speed/cost) · swappable via env var to Sonnet or Opus

---

## Vision: Full Tier Architecture

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  DATA SOURCES                                                               │
 │                                                                             │
 │  Standard (live)            Connected*              Agency*                 │
 │  ────────────────           ─────────────────────   ──────────────────────  │
 │  Page HTML                  Google Analytics 4      SEMrush / Ahrefs        │
 │  Google PageSpeed           Google Search Console   Meta Ads API            │
 │  robots.txt / sitemap       (OAuth service account) Klaviyo / ESP           │
 │                                                     SimilarWeb              │
 └──────────┬──────────────────────────┬───────────────────────────┬───────────┘
            │                          │                           │
            │  HTTP fetch              │  service account OAuth    │  API keys
            │  (no auth)               │                           │
            ▼                          ▼                           ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  AGENCY DATA LAYER  †                                                       │
 │                                                                             │
 │  Stored audit history  ·  client benchmarks  ·  competitive patterns       │
 │  industry scoring norms  ·  longitudinal tracking (before/after changes)   │
 │                                                                             │
 │  → This is first-party data. Accumulated over engagements, it becomes      │
 │    a proprietary intelligence asset no competitor can replicate.            │
 └──────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  ANALYSIS TEAM  ·  configurable agents, weighted scoring                   │
 │                                                                             │
 │  Content & Messaging   ·   Conversion / CRO   ·   SEO & Technical          │
 │  Brand & Growth Strategy   ·   Competitive Positioning                     │
 │                                                                             │
 │  → each agent receives relevant data slice only (not full firehose)        │
 │  → prompts and weights are the primary tuning surface                      │
 └──────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  OUTPUTS                                                                    │
 │                                                                             │
 │  Real-time UI           Markdown report        Discord ops log              │
 │  White-label delivery*  Client briefing deck*  Trend analysis†              │
 └─────────────────────────────────────────────────────────────────────────────┘

  * roadmap   † requires Agency Data Layer
```

---

## The Direct Mail Parallel

This architecture is **not specific to digital marketing audits.** The same system — data sources, connectors, agency data layer, analysis team, outputs — maps directly onto what a direct mail agency already does manually when auditing a circulation management client.

The inputs change. The intelligence layer is identical.

```
 Digital Marketing Audit          Circulation Management Audit
 ────────────────────────         ──────────────────────────────
 DATA SOURCES                     DATA SOURCES
 Page HTML                   →    Mail file (names, segments, RFM)
 Google Analytics             →    Response history by drop / format
 Search Console               →    List suppression & hygiene data
 PageSpeed / Core Web Vitals  →    Package/format test history
 SEMrush / Ahrefs             →    Postal data (NCOA, deliverability)
 Meta Ads API                 →    Co-op database / list rental data
                                   Catalog / SKU performance data

 ANALYSIS TEAM                    ANALYSIS TEAM
 Content & Messaging         →    Offer & Creative Analysis
 Conversion / CRO            →    Response Rate & Lift Analysis
 SEO & Technical             →    List Health & Segmentation
 Brand & Growth              →    Circulation Strategy
 Competitive Positioning     →    Competitive Circulation Analysis

 AGENCY DATA LAYER                AGENCY DATA LAYER
 Client benchmark scores     →    Historical response rates by client
 Industry norms              →    Format/package performance library
 Competitive patterns        →    Proven list sources by vertical
```

The direct mail version of this system is not a future product — it is the **same product** applied to data the agency already collects today. The audit engine is the reusable layer. The data schema and agent prompts are the configuration.

**What this means for the pitch:** the agency is not being asked to adopt something foreign. They are being shown a more systematic version of analysis work they already do, delivered faster and with greater consistency. The data layer they would build over time is an asset they already own, just not yet in structured form.

---

## Key Design Decisions

**Why Edge Functions?**
SSE streaming requires a persistent connection that Vercel's serverless functions time out on. Edge runtime keeps the stream alive for the full 30–60 second analysis window.

**Why 5 parallel agents vs. one big prompt?**
Specialization produces better analysis per dimension, and parallelism keeps total latency near the slowest single agent (~20–30s) rather than summing all five. Each agent receives only the data relevant to its domain.

**Why not a database yet?**
At pitch/demo scale, Discord serves as an ops log and localStorage serves individual user history. A database becomes justified when: (a) multi-user audit history is required, (b) the Agency Data Layer needs to be queryable across clients, or (c) Connected tier OAuth tokens need storage. All three are Tier 2+ concerns.

**Why is the Data Layer a moat?**
Any agency can access the same AI models. The differentiator is the accumulated library of client benchmarks, industry norms, and what-works-for-whom knowledge that builds up over engagements. That library trains better prompts, enables tighter scoring calibration, and supports the kind of "how does your site compare to others in your category" framing that clients find compelling.
