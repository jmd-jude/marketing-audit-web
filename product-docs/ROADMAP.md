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

- [ ] **Downloadable report** (Markdown or PDF)
  Client-side generation from audit state. Strong pitch closer — hand the client a file at the end of the screen share.
  _Effort: S | Impact: H_

- [ ] **`robots.txt` + `sitemap.xml` fetch**
  Pull these directly alongside the homepage HTML. Gives the technical agent real crawlability data instead of inference.
  _Effort: S | Impact: M_

- [ ] **Google PageSpeed API key**
  Currently running unauthenticated (rate-limited). Add `GOOGLE_PAGESPEED_API_KEY` env var for production reliability.
  _Effort: XS | Impact: L_

---

### Tier 2 — Client Grants Access (OAuth / Service Account)

- [ ] **Google Analytics 4 API**
  Client adds service account as viewer on their GA4 property. Unlocks: real traffic volumes, channel breakdown, conversion rates, bounce rates, session data. Transforms the growth/strategy agent from inference to evidence.
  _Effort: L | Impact: H_

- [ ] **Google Search Console API**
  Same service account grant. Unlocks: organic keyword impressions, CTR, average position, index coverage, Core Web Vitals field data. Massive upgrade to SEO agent accuracy.
  _Effort: L | Impact: H_

- [ ] **OAuth connect flow UI**
  "Connect your Google account" step before or during audit. Stores tokens per audit session (or per saved client profile). Gate on the Connected tier.
  _Effort: L | Impact: H_

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

### UX / Product

- [ ] **Saved audit history** (localStorage or DB)
  Results disappear on refresh currently. localStorage is a quick win; Vercel Postgres/Supabase for multi-session.
  _Effort: S–M | Impact: M_

- [ ] **Side-by-side competitor audit**
  Run the same audit on a competitor URL and display results in parallel columns. Natural upsell conversation starter.
  _Effort: M | Impact: H_

- [ ] **Data sources panel in UI**
  Show what's connected vs. available per audit. Visual representation of the tier model — makes the upsell implicit.
  _Effort: S | Impact: H (pitch value)_
  _Status: In progress_

- [ ] **Model selector toggle**
  Let agency staff switch between Haiku (fast/cheap), Sonnet (default), Opus (deep analysis) from the UI.
  _Effort: S | Impact: M_

- [ ] **White-label / client branding**
  Agency name + logo in header, custom color scheme. Required for client-facing delivery.
  _Effort: M | Impact: H (commercial)_
