# AEO Agent Strategic Analysis

## Context

The AEO transcript (HubSpot's Asia Frost, March 2026) makes a credible case that answer engine visibility is a distinct discipline from SEO — different signals, different content structure, different platform strategy. The question is whether this warrants a 6th team member in the audit tool, and if so, what it would need and how much of that is already flowing.

---

## The 7 AEO Insights, Mapped to Current Coverage

| Insight | What It Requires to Audit | Already In Pipeline? | Current Agent Coverage |
|---|---|---|---|
| 1. Blogs still matter — 62% of citations | Blog/content page presence, structure quality | Yes — Firecrawl homepage + interior pages | Content agent (partially) |
| 2. Queries are long-context; content needs persona/use-case specificity | Page content analysis for specificity vs. genericism | Yes — page markdown | Content agent (partially) |
| 3. Structural signals: question headings, FAQ, FAQ schema, TLDR, stats, 20+ external links | Page markdown + schema detection | Yes — Firecrawl markdown has heading structure; schema partially detected | Technical agent (schema only); Content agent (partially, not explicitly scored) |
| 4. Freshness — visible last-updated date, recency of content | On-page date signals | Yes — in page markdown/HTML | Not currently scored by any agent |
| 5. Backlinks don't predict AI visibility | N/A — this is a *deprioritization* insight | N/A | Technical agent currently receives DataForSEO rank data which includes backlink signals — slight misalignment |
| 6. Consensus via LinkedIn, Reddit, YouTube | Off-page presence on those platforms | No — nothing currently scrapes or accepts this | Not covered at all |
| 7. Volatility — trends matter more than snapshots | Longitudinal tracking (multiple audits over time) | Partially — every audit is persisted to Neon, but no diff/trend layer exists | Not surfaced |

---

## What a Standalone AEO Agent Would Need

**From existing pipelines (already flowing):**
- Firecrawl homepage markdown → heading structure (question-formatted H2/H3s?), FAQ presence, stat density, TLDR presence, external link count estimate
- Schema detection (already in technical agent context) → FAQ schema specifically
- Interior pages → same structural checks on blog/content pages

**Not in any current pipeline:**
- LinkedIn company page activity / post frequency
- Reddit brand mention presence / thread participation
- YouTube channel existence / transcript signal
- HubSpot AO / xFunnel / Semrush AI visibility score (no public API yet)
- Longitudinal diff between audit runs (data exists in Neon but no query layer)
- Content freshness signals (last-updated dates) — technically *in* the markdown but no agent looks for it

---

## The Honest Verdict on a 6th Agent

**Arguments for adding one:**
- AEO is genuinely distinct — the backlinks finding alone demonstrates the disciplines diverge. A separate agent signals to prospects that this is real analysis, not just SEO rebranded.
- Structural page signals (question headings, FAQ, FAQ schema, TLDR, stat density) are clearly evaluable from current data and not currently scored by anyone. They'd feel orphaned tacked onto Technical or Content.
- The category is hot right now. Having an "AEO" team member is a positioning asset for the tool itself.

**Arguments against (yet):**
- The most powerful AEO signals — platform presence (LinkedIn/Reddit/YouTube) and longitudinal visibility tracking — require net-new pipelines. Without them, the agent is doing structural page analysis that's hard to distinguish from what Technical + Content already do.
- A 6th parallel Claude call adds ~20% to token cost per audit.
- Structural AEO signals (question headings, FAQ, freshness) could land cleanly as new *dimensions* inside the Technical agent without a new agent.

---

## Recommendation

**Don't add a 6th agent yet — but do one thing on the roadmap.**

### Quick Add 1: AEO dimensions in the Technical agent (~low effort, existing data)
Add 2-3 explicit AEO scoring dimensions to the Technical agent's rubric:
- FAQ section + FAQ schema presence
- Question-formatted headings (H2/H3 structured as questions)
- Visible last-updated / content freshness signal
- Stat/unique data density on key pages
- TLDR section presence

All of this is detectable from the Firecrawl markdown already flowing to the Technical agent. Zero new pipelines. The Technical agent's output section could call this "AI Discoverability" or "Answer Engine Readiness" and frame findings accordingly.

### Roadmap: Standalone AEO Agent (when one new data source lands)
The right trigger for promoting AEO to a full team member is when at least one of these becomes available:
- **Platform presence input** — even a simple user-provided field ("Are you active on LinkedIn/Reddit/YouTube? Y/N/link") would let the agent make presence recommendations vs. gap analysis
- **AI visibility API** — HubSpot AO went into public beta last week per the transcript. If they publish an API, this becomes extremely compelling data to pipe in. Same for Semrush's AI visibility feature. Also worth checking DataForSEO — they already have an established API surface and have been adding LLM/AI-related endpoints; if they offer brand mention or AI citation visibility data, it's a natural fit given the existing DataForSEO integration already in the pipeline.
- **Longitudinal diff** — if/when a returning-client flow exists, the Neon data already supports a "your AEO signals vs. 90 days ago" view

At that point, a standalone agent with a weight around 15% (pulling from competitive or strategy) makes sense. Its job would be: how well is this site positioned to be *cited* by AI, not just ranked by Google.

---

## Files That Would Change for Quick Adds

- `lib/agents.ts` — Technical agent system prompt: add AEO dimension rubric + backlink deprioritization instruction
- No pipeline changes required — data already flows
