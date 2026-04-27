# Data Pipelines: Strategic Analysis

This document is the strategy layer companion to `data-pipelines.md`. While that spec explains what data is pulled and how it's transformed, this document explains the SEO purpose, interpretation logic, and actionable use cases for each data point and endpoint.

**Framework:** Each data source maps to a strategic layer:
- **Firecrawl** — The Content & Structure layer. What the site actually says, how it's organized, and what CMS or tooling built it.
- **PageSpeed Insights** — The Experience & Crawlability layer. How fast and accessible the site is for users and bots.
- **GSC** — The Visibility & Intent layer. What Google thinks of the site and how users find it before the click.
- **GA4** — The Value & Friction layer. What happens after the click: behavior, engagement, conversion.
- **DataForSEO** — The Market & Competitive layer. External context: keyword difficulty, competitor rankings, and SERP real estate the site doesn't yet own.

---

## Firecrawl — The Content & Structure Layer

**Source:** `firecrawlFetch()` in `app/api/audit/route.ts`  
**Fallback:** Raw HTML fetch when `FIRECRAWL_API_KEY` is unset  
**Called for:** Homepage (8s timeout, 15k char truncation) + up to 3 interior pages (8s timeout, 3k char truncation each)

Firecrawl converts a live page into clean markdown plus structured metadata. It's the foundation every agent builds on — without it, agents are reading stripped HTML noise. The strategic value isn't just cleaner text; it's that the structured metadata exposes signals that would require regex parsing against raw HTML.

---

### Metadata Fields

| Field | Strategic Signal |
|---|---|
| `title` | The `<title>` tag. The single most weighted on-page SEO element. If it's missing, generic ("Home"), or keyword-stuffed, that's a primary finding. Compare against GSC's top queries — if the title has no overlap with the queries driving impressions, the page is ranking despite its title, not because of it. |
| `description` | The meta description. Doesn't affect rankings directly, but controls CTR in the SERP. A missing or auto-generated description is a cheap win. A truncated one (> 155 chars) wastes the impression. |
| `og:title` / `og:description` / `og:image` | Open Graph tags. These control how the page renders when shared on LinkedIn, Slack, or email. Missing OG tags = every social share looks broken. For B2B sites where content gets shared in Slack threads, this matters more than most clients realize. |
| `canonical` | The canonical URL. If this doesn't match the page URL, either there's intentional deduplication happening or a misconfiguration. A canonical pointing off-site is almost always a mistake. |
| `robots` | The meta robots directive. `noindex` on a page that's supposed to rank is a critical error. `nofollow` on internal links limits crawl equity distribution. This field should trigger a hard flag if it contains `noindex`. |
| `generator` | CMS fingerprint (e.g., "Wix.com Website Builder", "WordPress 6.4"). This is a high-value signal for the technical agent. Wix and Squarespace have known SEO limitations (URL structure, JS rendering, limited schema markup). Knowing the CMS before analyzing technical issues frames the entire diagnosis. |
| `language` | Declared page language. Mismatch between declared language and actual content is an internationalization issue that can suppress rankings in the correct locale. |

**Interpretation Logic:**

- `title` present but generic ("Home", "Welcome") = the site was built by someone thinking about navigation, not search.
- `og:image` missing = every social share uses a browser-generated thumbnail or nothing. On a service business site, that's a credibility gap every time the URL gets pasted into a client email.
- `generator` = "Wix.com Website Builder" means: expect limited structured data support, constrained URL architecture, and JS-dependent rendering. Frame technical findings accordingly — some issues are platform limitations, not fixable without migration.
- `robots` containing `noindex` on a non-homepage URL is worth calling out explicitly. It's frequently left behind from staging environments.

---

### Markdown Content

**The Why:** The markdown body is the raw material for content, strategy, competitive, and conversion agents. The strategic question it answers: *Does this site say the right things to the right people in the right order?*

**Interpretation Logic:**

- **Word count** (derived from markdown): Under 300 words on a homepage is thin. Google's quality guidelines don't specify a number, but pages with minimal content give the model very little to work with — and give Google very little to index. Under 200 words with no interior pages fetched means the audit is working with almost no signal.
- **H1s** (parsed from markdown `#` headings): There should be exactly one. Multiple H1s suggest either a template that wraps every section in a heading, or a page builder that doesn't understand heading hierarchy. Zero H1s is an immediate on-page SEO flag.
- **Content structure**: Agents reading markdown can assess whether the page leads with value proposition or buries it, whether CTAs are present, whether pricing signals exist. This is where the content and conversion agents do their core work.

**Firecrawl `hasStructuredData`:** The homepage Firecrawl request now includes `html` format alongside `markdown` and `links`. `metadataFromFirecrawl` runs the JSON-LD regex against the actual HTML response, so `hasStructuredData` correctly reflects the page. Interior page fetches do not request the `html` format (they only use the markdown). The raw HTML fallback path (`extractPageMetadata`) detects JSON-LD correctly and always did.

---

### Interior Page Routing (`PAGE_CONFIG`)

Interior pages are selected by pattern-matching extracted links against `PAGE_CONFIG` scores, then fetching the top 3. The routing table determines which agents receive each page type:

| Page Pattern | Score | Agents |
|---|---|---|
| `/pricing`, `/plans`, `/packages` | 10 | `conversion`, `competitive`, `content` |
| `/about`, `/about-us`, `/team` | 9 | `strategy`, `content` |
| `/services`, `/solutions`, `/products` | 9 | `competitive`, `content`, `strategy` |
| `/contact`, `/demo`, `/book` | 7 | `conversion` |
| `/how-it-works`, `/process` | 6 | `strategy`, `content` |
| `/case-studies`, `/portfolio`, `/results` | 5 | `competitive`, `strategy` |

**Strategic Interpretation:**

- A pricing page that's unreachable (not linked from homepage, not in sitemap) won't be fetched and won't reach the conversion agent. The audit will underdiagnose conversion issues for that site.
- A site with no `/about` or `/services` equivalent in its link structure signals either a single-page site or a navigation architecture that doesn't use predictable URL patterns. Both are worth flagging.
- Interior pages are truncated to 3k chars each. For dense pages (long-form services pages, detailed case studies), the agent sees the top third of the content only. Agents should be aware that absence of evidence isn't evidence of absence on interior pages.

**The technical agent intentionally receives no interior pages.** It works only from the homepage. This is the right call — technical issues (Core Web Vitals, crawlability, structured data) are assessed at the domain level, not per-page. Don't change this routing.

---

### Links Array

**The Why:** The links array from Firecrawl drives interior page discovery. It's filtered to same-domain URLs, deduplicated, and asset URLs (pdf, images, js, css) are stripped before scoring.

**Strategic note:** If a site uses JavaScript-rendered navigation (common on React/Next.js sites without SSR, or Webflow with JS-only nav), Firecrawl may not extract all internal links. The `PAGE_CONFIG` selector only sees links that appear in the static HTML. A site with a JS-only menu will look like a single-page site to the crawler even if it has 50 pages. The technical agent should flag this if the link count is suspiciously low relative to other signals.

---

### Agent Distribution

| Data | Agents |
|---|---|
| Homepage markdown + metadata | All 5 (as `pageContent`) |
| Interior pages | Per `PAGE_CONFIG` routing (technical excluded) |
| `hasStructuredData`, `generator`, `metaRobots` | Technical (via page metadata in user message) |

---

## PageSpeed Insights — The Experience & Crawlability Layer

**Source:** `fetchPageSpeed()` in `app/api/audit/route.ts`  
**API:** Google PageSpeed Insights v5 (`pagespeedonline/v5/runPagespeed`)  
**Strategy:** Mobile only (`strategy: 'mobile'`)  
**Categories:** Performance, Accessibility, SEO, Best Practices  
**Timeout:** 30 seconds  
**Agent distribution:** Technical only

PageSpeed runs Lighthouse against the live URL in a simulated mobile environment. It returns four category scores, six Core Web Vitals metrics, and two filtered lists of actionable issues. It's the only data source in the pipeline that directly reflects user experience quality as Google measures it.

**Why mobile only:** Google uses mobile-first indexing. The mobile score is the one that affects rankings. Desktop performance is largely irrelevant for ranking purposes, though it matters for conversion on desktop-heavy audiences.

---

### Lighthouse Category Scores

| Score | Threshold | Interpretation |
|---|---|---|
| Performance | < 50 poor / 50–89 needs work / 90+ good | The most ranking-relevant score. Below 50 on mobile is a significant handicap. |
| Accessibility | < 70 poor / 70–89 needs work / 90+ good | Not a direct ranking factor, but correlates with technical quality. Low scores often indicate missing alt text, poor contrast, or unlabeled form fields — all of which affect conversion, not just accessibility compliance. |
| SEO | < 70 poor / 70–89 needs work / 90+ good | Lighthouse's SEO audit covers crawlability basics: meta description present, legible font sizes, no blocked resources, hreflang valid. A low SEO score here flags issues Google's crawler will hit before it even evaluates content quality. |
| Best Practices | < 70 poor / 70–89 needs work / 90+ good | HTTPS, no console errors, valid JS, no deprecated APIs. A low Best Practices score is a technical debt signal — the site has accumulated browser compatibility or security issues. |

**Combination reads:**

- **Low Performance + Low SEO:** The site has both speed and crawlability problems. Google is penalizing it twice. Priority: fix crawlability first (immediate ranking impact), then performance (longer-term ranking and conversion impact).
- **Low Performance + High GSC impressions:** The site ranks well despite poor performance — it has strong content and backlink authority overcoming the technical penalty. Fixing performance here has unusually high leverage because the authority is already there.
- **High Performance + Low GSC CTR:** The site is fast but the SERP presentation is weak. Performance isn't the problem; title/meta optimization is.
- **Low Accessibility + High GA4 bounce rate:** Accessibility issues often manifest as UX friction. Screen-reader failures and keyboard navigation issues affect all users, not just those using assistive technology.

---

### Core Web Vitals

These six metrics are the specific signals Google's Page Experience ranking system uses. Understanding what each measures matters because the remediation for each is different.

| Metric | What It Measures | Good | Needs Work | Poor | What a Bad Score Means |
|---|---|---|---|---|---|
| **FCP** (First Contentful Paint) | Time until first text or image renders | < 1.8s | 1.8–3s | > 3s | Server response is slow, or render-blocking resources (CSS/JS in `<head>`) are delaying the first paint. |
| **LCP** (Largest Contentful Paint) | Time until the largest visible element renders | < 2.5s | 2.5–4s | > 4s | The hero image or headline is loading slowly. Usually: unoptimized hero image, no lazy loading, slow CDN, or server latency. LCP is the Core Web Vital most correlated with ranking impact. |
| **TBT** (Total Blocking Time) | Total time the main thread was blocked during load | < 200ms | 200–600ms | > 600ms | JavaScript is blocking the browser from responding to user input. Symptom of heavy third-party scripts, large JS bundles, or undeferred analytics. |
| **CLS** (Cumulative Layout Shift) | Visual stability — how much elements move during load | < 0.1 | 0.1–0.25 | > 0.25 | Images without dimensions, late-loading ads, or injected banners are causing elements to shift. Users trying to click a CTA and hitting a shifted element is a direct conversion killer. |
| **Speed Index** | How quickly content is visually complete | < 3.4s | 3.4–5.8s | > 5.8s | Composite of visual rendering speed. High Speed Index with good FCP usually means content is progressively rendering slowly. |
| **TTI** (Time to Interactive) | Time until the page is fully interactive | < 3.8s | 3.8–7.3s | > 7.3s | The page looks loaded but isn't responding. Heavy JS initialization is the usual cause. On conversion pages, a high TTI means users are trying to interact with forms or CTAs before the JS has attached event listeners. |

**The most important of these for ranking:** LCP. Google has stated it's the strongest Core Web Vital signal in the Page Experience system.

**The most important for conversion:** CLS and TTI. CLS causes misclicks. TTI causes users to think the page is broken.

---

### Opportunities

**What they are:** Lighthouse-flagged issues with `score < 0.9` and `details.type === 'opportunity'`. These are specific, actionable items with an estimated savings value (time in ms).

**Examples:** "Eliminate render-blocking resources", "Properly size images", "Serve images in next-gen formats", "Remove unused JavaScript".

**Interpretation:** Opportunities are ranked by estimated impact internally by Lighthouse, but the pipeline takes the first 5 by iteration order. The agent receives them as a list of titles without savings estimates. When multiple opportunities appear, the agent should treat them as a prioritized list rather than an undifferentiated set.

**Cross-source synergy:** Map opportunities against GA4 device breakdown. "Properly size images" on a site where 70% of sessions are mobile has a different urgency than the same finding on a 90% desktop site.

---

### Diagnostics

**What they are:** Lighthouse audits with `score < 0.5` and `details.type === 'table'`. These are issues that failed significantly — not marginal scores but real failures.

**Examples:** "Avoid enormous network payloads", "Serve static assets with an efficient cache policy", "Avoid an excessive DOM size".

**Interpretation:** Diagnostics represent more structural issues than opportunities — things that require architectural changes rather than quick optimizations. An "excessive DOM size" diagnostic on a Wix site, for example, is a platform limitation, not a fixable code issue. Knowing the CMS (from Firecrawl's `generator` field) is essential context for reading diagnostics correctly.

---

### Strategic Notes for the Technical Agent

- **PageSpeed data is authoritative.** The route injects an explicit instruction: "Use these REAL numbers in your scoring and analysis. Do not estimate or guess." The technical agent should never hedge on performance scores — the numbers are in the context.
- **Mobile scores only.** Don't infer desktop performance. Don't compare to desktop benchmarks.
- **Opportunities + diagnostics are pre-filtered.** The agent receives a maximum of 5 each. These aren't all issues — they're the worst ones. If both lists are empty, Lighthouse found no significant problems, which is worth stating positively.
- **A null PageSpeed result** means the fetch timed out or the API returned an error. The agent should note data unavailability rather than estimating. This happens more than expected on slow sites — the 30s timeout is generous, but heavily JS-dependent sites can still exceed it.

---

## DataForSEO — The Market & Competitive Layer

### Endpoint 1: Domain Rank Overview

**The Why:** This answers the foundational positioning question: where does this domain stand in the organic search ecosystem, and is it gaining or losing ground?

**Field-by-Field Interpretation:**

| Field | Good Signal | Bad Signal | What It Actually Tells You |
|---|---|---|---|
| `pos_1` | Any count > 0 | 0 | Brand monopoly on its own SERP. If a non-brand site has multiple pos_1 rankings, they've built real topical authority. |
| `pos_2_3` | Significant count | — | "Almost there" opportunity. These are the highest-leverage keywords for a content+CRO play. A push to pos_1 here is often cheaper than building new pages. |
| `pos_4_10` | Large count | — | The real low-hanging fruit bucket. These keywords are indexed, Google trusts the page somewhat, but it hasn't cleared the first-page threshold. This is the primary content optimization queue. |
| `organic.count` | Growing QoQ | Declining | Total footprint. Declining count means pages are getting deindexed or dropping off entirely, not just slipping positions. |
| `organic.etv` | — | — | Baseline traffic proxy. Cross-reference against GA4 actual sessions to spot the coverage gap. If DataForSEO estimates 10k visits/mo and GA4 shows 2k, either the keyword targeting is off or there's a serious technical crawl issue. |
| `estimated_paid_traffic_cost` | — | — | A proxy for the commercial value of the organic footprint, not a real dollar figure. High value here against low actual paid spend means the domain is punching above its ad budget in organic. Use this in positioning conversations. |
| `is_up / is_down / is_lost` | is_up > is_down | is_lost high | `is_lost` is the most important of the three. Lost keywords signal algo penalties, site migrations gone wrong, or competitor pages that have definitively out-earned you. `is_down` is normal volatility. `is_lost` is not. |
| `paid.count` | — | — | 0 = no PPC detected. This isn't just a budget signal — it tells you whether the domain is competing on organic alone and whether competitors have a paid-organic squeeze play on brand terms. |
| `paid.estimated_paid_traffic_cost` | — | — | If non-zero, the domain is paying for search traffic. Cross-reference with `organic.etv`: if paid cost >> organic value, SEO is underdeveloped relative to ad dependency. That's a specific pitch angle. |

**Actionable Use Case:** Pull `pos_4_10` keywords (see gap note below), sort by estimated volume, cross-reference with GA4 landing page performance. Pages ranking 4–10 that have high GA4 `bounceRate` are ranking on the strength of other signals despite thin content. Fix the content; the ranking already exists.

**Keyword-level resolution is now live** via the `/ranked_keywords/live` endpoint (see Endpoint 3 below). Agents now receive the specific keywords behind the position-4–20 bucket.

---

### Endpoint 2: Competitors Domain

**The Why:** Who is actually competing for the same search real estate, and how large is the gap?

**Field-by-Field Interpretation:**

| Field | Interpretation |
|---|---|
| `avg_position` | Lower avg position with high `intersections` = a direct threat. This competitor wins on the same keywords, consistently. |
| `intersections` | The actual overlap count. Low intersections with a matching niche = a different audience segment, not a direct competitor. High intersections = zero-sum competition. |
| `metrics.organic.etv` | Compare against the audited domain's `etv`. If a competitor's etv is 10x yours with similar intersections, they've solved something you haven't. Analyze their top pages, not just their domain. |
| `metrics.organic.count` | The competitor's full footprint. A site with 200k ranking keywords vs. your 5k isn't your competition in the traditional sense — they're a domain authority anchor. Filter for similar count-range competitors for apples-to-apples comparison. |

**Actionable Use Case:** Sort the top 10 competitors by `intersections` descending. Take the top 3. For each, compare their `avg_position` against the audited domain's equivalent. Where the competitor ranks significantly better on the same keyword set, that's a content or authority gap, not a technical one. That gap drives the content strategy recommendation.

**Cross-API Synergy (high value):** Map competitor `etv` against their `intersections` with the audited domain. Then pull GA4 `sessionsByChannel`. If "Organic Search" is a small channel share and competitors have massive `etv`, the domain is losing the organic channel to exactly these competitors. The recommendation becomes: expand organic footprint by targeting `pos_4_10` keywords where these competitors don't yet dominate.

---

### Endpoint 3: Ranked Keywords (Positions 4–20)

**Source:** `/dataforseo_labs/google/ranked_keywords/live`  
**Filter:** `rank_group >= 4 AND rank_group <= 20`  
**Limit:** 25 results, sorted by `search_volume desc`  
**Agent distribution:** Technical + Strategy (`KEYWORDS_AGENTS`)

**The Why:** The domain rank overview tells you *how many* keywords are in a position range. This endpoint tells you *which* ones. The position-4–20 range is strategically significant: these are keywords where Google has already decided to rank the site (it trusts the content), but hasn't cleared the first-page threshold yet. This is the highest-leverage optimization queue for any site that isn't brand new.

Sorting by search volume descending means agents see the highest-opportunity keywords first, not alphabetical noise.

**Field-by-Field Interpretation:**

| Field | Interpretation |
|---|---|
| `keyword_data.keyword` | The actual keyword text. This is what to build around — title tag, H1, meta description. |
| `ranked_serp_element.serp_item.rank_group` | Current position. Position 4–10 is page 1 gap (one nudge away from top 3 visibility). Position 11–20 is page 2 (needs content + authority work). |
| `keyword_data.keyword_info.search_volume` | Monthly search volume. Prioritize by volume — moving a 10k/mo keyword from position 8 to position 3 is worth 10–15x more traffic than the same move on a 500/mo keyword. |

**Actionable Use Cases:**

- **Technical agent:** Cross-reference high-volume position-4–10 keywords against the page's title tag and H1. If the keyword doesn't appear in either, that's a quick win — the ranking exists, the on-page signal is weak.
- **Strategy agent:** When GSC is unavailable (the primary use case for prospects who haven't connected their account), this keyword list IS the organic evidence. Treat it as ground truth for the keyword opportunity assessment.
- **Cross-source:** Map these keywords against GA4 landing page bounce rates. A keyword ranking at position 7 with a 90% bounce rate on its landing page is ranking despite the content, not because of it — the ranking signal came from external sources (links, brand searches) but the page doesn't satisfy the intent.

**Data Caveats:**

- Volume reflects global or country-level estimates, not localized data. Local service businesses may see inflated volumes for head terms they'll never realistically compete for.
- The 25-keyword limit captures the highest-volume slice, not the full tail. For large sites (1M+ ranking keywords), there are thousands of position-4–20 terms — this is a representative sample for agent reasoning, not an exhaustive list.

---

## Google Search Console — The Visibility & Intent Layer

### Property Resolution

This step is more strategically significant than it reads. A domain-type property (`sc-domain:`) aggregates data across all URL variants (http, https, www, non-www). A URL-prefix property doesn't — it only covers what was explicitly verified. If the resolver falls back to a URL-prefix property, the data is a partial picture.

**The spec doesn't currently surface which property type was matched.** An audit that unknowingly runs on a URL-prefix property will undercount impressions, clicks, and queries. The matched property type should be surfaced in the `fetched` SSE event alongside `connected: true` so agents and the report UI can flag when data is potentially partial.

---

### Call 1: Top Queries (90-day, 50 rows)

**The Why:** What does Google believe this site is about, and is that belief accurate?

**Interpretation Logic:**

- **High impressions, low CTR (< 2%):** Google is serving the page but users aren't clicking. The title tag or meta description isn't competitive for the query intent. This is the single most actionable on-page SEO problem identifiable without a full technical audit.
- **High position (avg 1–3), low impressions:** The site ranks well for narrow queries. Low topical breadth. Content expansion will have disproportionate impact.
- **High clicks, position 4–10:** Users who click are satisfying the intent well, but most searchers never see the page. A move from position 7 to position 3 is worth modeling — CTR at pos_3 is typically 3–5x higher than pos_7 at constant impressions.
- **Long-tail queries dominating the top 50:** If no broad category terms appear, the site lacks authority on head terms. That's a brand positioning problem, not just an SEO problem.

**Actionable Use Case:** Filter queries where `position` is between 11 and 20 (second page). These are the highest-leverage content update targets — the page is indexed and ranking, just not quite visible. The current 50-row limit may cut them off entirely. Consider requesting 200 rows to capture this tier.

**Cross-API Synergy:** Map top GSC queries against GA4 `sessionsByChannel`. If "Organic Search" drives 40% of sessions but the top queries are all branded, the organic channel is dependent on brand search, not ranking expansion. That's a fragile traffic base with a specific remediation path.

---

### Call 2: Top Pages (90-day, 20 rows, by clicks)

**The Why:** Which pages are doing the actual organic work?

**Interpretation Logic:**

- Healthy sites show a distribution: homepage plus several inner pages. A site where 80%+ of clicks go to the homepage has no content depth — Google has essentially only indexed one page of consequence.
- Cross-reference page URLs here against GA4 `topPages`. If a page drives high GSC clicks but poor GA4 engagement (high bounce, low duration), the page ranks for the wrong intent. It attracts clicks from queries it can't satisfy. That's a targeting problem, not a content quality problem.

**Actionable Use Case:** Take the top 10 GSC pages by clicks. Pull their GA4 `bounceRate` and `averageSessionDuration`. Pages in the top quartile by clicks but the bottom quartile by engagement are "intent mismatch" candidates. Rewrite their targeting, not their content.

---

### Calls 3 & 4: 30-day Trend vs. Prior 30-day

**The Why:** Is organic visibility growing, stable, or decaying, and is the change recent or ongoing?

**Interpretation Logic:**

- **Click delta without impression delta:** CTR shifted. Usually a title/meta change, a SERP feature displacement, or a significant position change on a high-volume term.
- **Impression delta without click delta:** Google is serving the site more but users aren't clicking. Either new pages got indexed (good) or impression share is expanding at lower positions (neutral to bad).
- **Both declining:** Could be an algorithm update, manual action, technical regression (crawl budget, canonicalization errors), or seasonal.

**Caution:** The 30-day vs. prior 30-day window is short. Algorithm updates have a 3–6 month settling window. A decline that looks like a recent event might be the tail of a core update. The strategy agent should be careful about diagnosing "recent algorithm hit" from 30 days of data alone.

---

### Call 5: Sitemaps

**The Why:** Is Google's index of this site healthy, and are submitted pages actually getting indexed?

**Interpretation Logic:**

- `submitted` vs. `indexed`: The gap between these is the crawl efficiency ratio. A site submitting 200 pages and having 80 indexed has a serious crawl or quality issue. Google is choosing not to index 60% of submitted pages — thin content, duplicate content, canonicalization problems, or `noindex` tags applied by mistake.
- A gap > 20% is a red flag worth calling out explicitly.
- The interpretation changes based on what those pages are. 120 unindexed pages on a blog (tags, categories, pagination) is likely fine. 120 unindexed pages on a 150-page B2B site is critical. The spec can't distinguish these cases — agent prompts should acknowledge the ambiguity.

**Actionable Use Case:** If `indexed / submitted < 0.8`, the technical agent should flag indexation efficiency as a primary finding. This single ratio can explain underperformance that 20 other metrics only hint at.

---

## Google Analytics 4 — The Value & Friction Layer

### Report 1: Sessions by Channel

**The Why:** How dependent is this site on any single traffic channel, and is that dependency a risk?

**Interpretation Logic:**

- A healthy channel mix has no single source above 60% of sessions. Over-reliance on "Organic Search" means an algorithm update can crater the business. Over-reliance on "Direct" often means dark social or email attribution bleed, not genuine direct navigation.
- `Paid Search` appearing here cross-references against DataForSEO `paid.count`. If paid search sessions appear in GA4 but DataForSEO shows 0 paid keywords, the paid activity is either very new or targeting non-indexed terms.

**Cross-API Synergy:** If GSC organic clicks are growing (30-day trend positive) but GA4 "Organic Search" sessions are flat or declining, there's likely a tracking gap. GA4 may be misconfigured, or sessions are landing on pages without the GA4 snippet. That's a technical audit finding, not an SEO finding.

---

### Report 2: Top Landing Pages

**The Why:** Which pages are the actual business entry points, and are they working?

| Field | Interpretation |
|---|---|
| `bounceRate` | Landing page bounce rate is intentional context: users arrived from search, saw the page, and left. High bounce on landing pages (> 70%) means the page doesn't match the expectation the SERP created. |
| `averageSessionDuration` | Low duration on a content page = thin content or wrong audience. Low duration on a conversion page = either instant conversion (good) or immediate bail (bad). Duration alone is ambiguous without conversion context. |

**Cross-API Synergy:** This report is the completion of the GSC Call 2 analysis. GSC tells you which pages get organic clicks. GA4 tells you what those clicks do. Combined: "This page ranks for X queries, drives Y clicks per month, and has a Z% bounce rate and 45-second avg session." That's a complete diagnostic.

---

### Report 3: New vs. Returning

**The Why:** Is the site building a relationship with its audience or just converting strangers?

**Interpretation Logic:**

- Weighted `engagementRate` and `bounceRate` from this report are site-wide quality signals. Engagement rate (sessions with > 10s, 1 conversion, or 2 pageviews) is GA4's replacement for the traditional bounce rate. A site at 40% engagement rate is not satisfying most of its visitors.
- High new-visitor share (> 85%) with low engagement = good at attracting traffic, bad at converting interest into return intent. That's a content depth and trust problem.
- High returning-visitor share with low new share = strong retention, weak acquisition. The organic/paid funnel isn't growing the audience.

---

### Report 4: Conversions by Channel

**The Why:** Where does revenue-adjacent behavior actually happen, and is organic search contributing?

**Interpretation Logic:**

- If conversion tracking is configured properly, this is the ROI layer and the most commercially important report in the pipeline.
- The 0-conversion filter is correct. The injected note when all rows are 0 is critical: it tells the agent (and the client) that this report is meaningless without proper event configuration. Both this report and Report 7 should be flagged together when that condition is true.
- `conversionRate` (conversions/sessions per channel) is more useful than raw conversion counts. A channel with 50 sessions and 5 conversions (10%) is more efficient than one with 5,000 sessions and 10 conversions (0.2%).

**Cross-API Synergy (highest value in the pipeline):** Map DataForSEO competitor organic footprint against GA4 conversion channel data. If competitors have 5x the organic footprint but the audited domain has a higher organic conversion rate, the problem isn't quality — it's coverage. The recommendation is pure content expansion, not optimization of existing pages. That's a fundamentally different roadmap than the inverse scenario.

---

### Reports 5 & 6: Device Category + Avg Engagement Time

**Device split — The Why:** Is the site's experience optimized for the audience actually using it?

Mobile-majority traffic against desktop-designed pages is a UX problem that Core Web Vitals will surface. If mobile sessions are > 55% and the PageSpeed mobile score is low, there's a compounding problem: bad experience for the primary audience, with ranking consequences.

**Avg engagement time — The Why:** Site-wide health proxy for content satisfaction.

Under 45 seconds is thin. Over 3 minutes on a service site suggests either high research intent (good) or confused navigation (bad). Context matters here — neither direction is automatically actionable without the channel and page data to explain it.

**Cross-API Synergy:** PageSpeed data (technical agent) + device split + avg engagement time form a complete UX picture. A site with poor mobile PageSpeed, 65% mobile traffic, and sub-60s avg engagement has a clear diagnosis: fix mobile performance, watch engagement time recover.

---

### Report 7: Top Events

**The Why:** Is the site instrumented to understand what users actually do, or is it flying blind?

The `session_start`, `first_visit`, `page_view` filter is correct — these are GA4 auto-events with no strategic signal.

**Interpretation Logic:**

- If the top 15 events are all in the noisy set, the injected note is accurate: custom tracking is incomplete. Conversion attribution in Report 4 is also incomplete. Flag both reports together.
- Useful custom events to look for: `form_submit`, `phone_click`, scroll depth thresholds, `video_play`, `cta_click`. Absence of these means the client is running a business with no behavioral feedback loop. That's a finding worth calling out directly, not softening.

---

## Cross-Pipeline Strategic Gaps

All three original gaps are now resolved.

**Gap 1 — Keyword-Level Resolution** *(resolved)*

Previously the pipeline returned aggregate counts (e.g., "47 keywords in positions 4–10") with no keyword list. Resolved by adding `/ranked_keywords/live` as a third parallel DataForSEO endpoint. Agents now receive the specific keywords, positions, and search volumes. See Endpoint 3 above.

**Gap 2 — GSC + DataForSEO Position Reconciliation** *(resolved)*

GSC tracks positions for queries where the site has impressions. DataForSEO tracks positions based on its own crawl. These numbers frequently diverge. The strategy agent (Step 3 in its diagnostic approach) is instructed to flag when DataForSEO shows a domain ranking for a keyword that has zero GSC impressions — interpreted as a geo targeting mismatch, personalization artifact, or cannibalization signal. Strategy agent Step 3 also handles the case where only DataForSEO data is available (no GSC): the keyword list becomes ground truth for the opportunity assessment.

**Gap 3 — Conversion Attribution Chain** *(resolved)*

GA4 conversion data existed (Report 4) but with no mechanism to link which specific sources drive conversions. Resolved by adding a `sessionSourceMedium` report to `fetchGa4Data` — returns `conversionsBySourceMedium` alongside the existing `conversionsByChannel`. Formatted as a separate table in the GA4 context block. Conversion agent prompt updated to reference specific source/medium rows when they reveal patterns the channel-level data obscures.
