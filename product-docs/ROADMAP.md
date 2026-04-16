# Marketing Intelligence — Product Roadmap

## Tier Model (Conceptual)

| Tier | Data Sources | Price Signal |
|---|---|---|
| **Standard** | Page HTML + PageSpeed Insights | Base |
| **Connected** | + GA4 + Search Console (OAuth) | ~5x |
| **Agency** | + SEMrush/Ahrefs + Klaviyo + Meta Ads | Custom |

---

## Backlog

### Tier 1 — No Auth Required (Low Effort, High Impact)

- [ ] **Meta Ads Library integration**
  Publicly accessible API. Show whether the site is running paid social, rough creative direction, ad volume signals. No auth needed. Adds a "Paid Media" dimension to the audit.
  _Effort: S | Impact: M_

- [x] **Downloadable report** (Markdown)
  Client-side generation from audit state. Strong pitch closer — hand the client a file at the end of the screen share.
  _Status: Shipped — downloads as `marketing-audit-{domain}.md`_

- [x] **`robots.txt` + `sitemap.xml` fetch**
  Fetched in parallel with homepage HTML. Passed to technical agent for real crawlability data.
  _Status: Shipped — `fetchRobotsAndSitemap()` in `app/api/audit/route.ts`_

- [x] **Google PageSpeed API key**
  `GOOGLE_PAGESPEED_API_KEY` env var in place for production reliability.
  _Status: Shipped_

---

### Tier 2 — Client Grants Access (OAuth / Service Account)

- [x] **Google Analytics 4 API**
  Operator connects their Google account (which has viewer access to client's GA4 property). Unlocks: real traffic volumes, channel breakdown, conversion rates, bounce rates, session data. Transforms the growth/strategy agent from inference to evidence.
  _Status: Shipped — `lib/gsc-ga4.ts`, `/api/connected-data`, GA4 property auto-discovered at connect time_

- [x] **Google Search Console API**
  Same operator OAuth grant. Unlocks: organic keyword impressions, CTR, average position, index coverage. Passed to technical, strategy, competitive, and content agents.
  _Status: Shipped — `lib/gsc-ga4.ts`, `/api/connected-data`_

- [x] **Service account connected tier** *(replaces OAuth)*
  OAuth flow was removed. A GCP service account authenticates to Google APIs server-side. No user-facing connect step — clients manually add the service account as a Viewer on their GA4 and Search Console properties. Data loads automatically on every subsequent audit of that domain. All OAuth routes return 410 Gone.
  _Status: Shipped — `/api/connected-data`, `lib/gsc-ga4.ts`_

---

### Tier 3 — Agency Subscription Tools (API Keys / MCPs)

- [ ] **SEMrush or Ahrefs API**
  Backlink profile, keyword gap vs. competitors, domain authority, traffic estimates. Requires agency subscription + API key. Could be wrapped as an MCP server.
  _Effort: XL | Impact: H_

- [ ] **Meta Ads API (authenticated)**
  Actual spend data, ROAS, audience targeting signals — requires client to grant Business Manager access. Different from the public Ads Library.
  _Effort: XL | Impact: H_

- [ ] **Klaviyo / ESP API**
  Email list size, open/click rates, flow revenue attribution. Requires client API key. Huge for DM/catalog clients specifically.
  _Effort: L | Impact: H (for target agency clients)_

- [ ] **SimilarWeb API**
  Traffic source mix, estimated monthly visits, competitor traffic comparison. Paid subscription.
  _Effort: M | Impact: M_

---

### Analysis Quality

- [x] **Connected data enrichment** — GA4 + GSC depth pass
  Wire up the full set of freely available metrics from both APIs: GA4 conversions by channel, device breakdown, per-page engagement quality, avg engagement time, top events. GSC index coverage (already stubbed), query trend vs. prior 30 days. No new OAuth scopes required. Prerequisite for meaningful conversion agent scoring and executive summary synthesis.
  _Status: Shipped — `lib/gsc-ga4.ts` interfaces, fetch functions, and formatters updated; conversion agent prompt updated to reference GA4 conversion + events data_

- [x] **Audit quality calibration** — scoring, benchmarks, and executive summary
  Fix session-weighted bounce rate calculation (bug). Compute agent scores from dimension averages rather than LLM-generated field. Add benchmark context to agent rubrics. Adjust score label thresholds (65 = "Average", not "Good"). Add sixth LLM call post-completion to synthesize a cross-cutting executive summary with ranked top priorities — rendered as a summary card above agent cards.
  _Status: Shipped — all items complete including executive summary call + UI card and full agent prompt rewrite per Senior Analyst Briefs_

- [ ] **Multi-page crawl**
  Currently fetches homepage only. Parse nav links from homepage HTML, identify up to 3–4 interior pages by URL pattern (about, services, pricing, contact), fetch at reduced truncation (~3–4k chars each). Route different page combinations to different agents — not every agent needs every page. Watch token costs: each additional page amplifies across all 5 parallel calls.
  _Effort: M | Impact: H | Priority: High — biggest qualitative gap in current analysis depth_

- [ ] **Dynamic pre-audit questionnaire** — AI-generated business context step
  Before launching the 5-agent audit, run a lightweight "discovery" pass on the homepage: infer business model, identify ambiguities the agents would otherwise have to guess at (pricing model, sales motion, target buyer, conversion goal), and generate 3–5 targeted questions specific to what the page actually shows. Surface those questions in the UI as an editable form — user confirms or edits, then hits Run. Answers get injected as `additionalContext` into all 5 agents. This replaces inference with knowledge for the highest-leverage inputs. A static fallback form (generic business context questions) is a simpler interim option if the AI-generated approach is deferred.
  
  The questionnaire becomes meaningfully sharper when multi-page crawl is available — the discovery agent has seen /about, /pricing, /services rather than just the homepage, so its hypotheses are better grounded. Sequencing: multi-page crawl first, then this.
  
  Token cost note: one additional lightweight LLM call before the main audit run. Negligible relative to the 5-agent payload, but adds a round-trip of latency (mitigated by the fact that user is filling out the form during that time).
  _Effort: M | Impact: H | Priority: High — directly addresses the core "no business context" gap; makes audit findings more credible and specific_

---

### Access & Monetization

- [x] **Invite code + run limit**
  Invite code field on landing page — valid codes in env var, checked server-side. Code stored in localStorage so re-entry isn't required. Each audit increments a localStorage counter; at N runs (e.g. 5) show a "complimentary audits used" message with a contact/upgrade CTA. Counter is bypassable but sufficient for demo-stage metering — anyone motivated enough to clear localStorage is a warm lead.
  _Status: Shipped — `INVITE_CODES` env var (comma-separated), `RUN_LIMIT = 3` in `page.tsx`, gate screen with contact CTA_

- [ ] **Stripe paywall**
  Natural successor to the run limit. Stripe Payment Link (no-code) for an audit pack (e.g. 10 audits / $49). On checkout success, issue a redemption token to localStorage and lift the gate. No backend payment logic required — Stripe hosts the checkout page.
  _Effort: M | Impact: H (commercial) | Priority: Lower — concierge model first; paywall relevant when moving to self-serve_

---

### UX / Product

- [ ] **Saved audit history** (localStorage or DB)
  Results disappear on refresh currently. localStorage is a quick win; Vercel Postgres/Supabase for multi-session.
  _Effort: S–M | Impact: M_

- [ ] **Side-by-side competitor audit**
  Run the same audit on a competitor URL and display results in parallel columns. Natural upsell conversation starter — though a motivated user can already do this by running audits separately.
  _Effort: M | Impact: H | Priority: High — strongest demo moment and easiest pitch closer_

- [x] **Data sources panel in UI**
  Show what's connected vs. available per audit. Visual representation of the tier model — makes the upsell implicit.
  _Status: Shipped — `DataSourcesPanel.tsx`, shows Active / Available / Roadmap sections with connect modals_

- [ ] **Model selector toggle**
  Let agency staff switch between Haiku (fast/cheap), Sonnet (default), Opus (deep analysis) from the UI.
  _Effort: S | Impact: M_

- [ ] **White-label / client branding**
  Agency name + logo in header, custom color scheme. Required for client-facing self-serve delivery.
  _Effort: M | Impact: H (commercial) | Priority: Lower — concierge model means the agency is always present; white-label becomes relevant when handing the tool directly to clients_
