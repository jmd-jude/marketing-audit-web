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

- [x] **OAuth connect flow UI**
  "Connect Google Analytics & Search Console" strip on landing page. Tokens stored in encrypted HttpOnly JWT cookie (24h session). Connect/Disconnect UI with live status indicator.
  _Status: Shipped — `/api/auth/{connect,callback,status,disconnect}`, connect strip in `app/page.tsx`_

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

- [ ] **Multi-page crawl**
  Currently fetches homepage only. Parse nav links from homepage HTML, identify up to 3–4 interior pages by URL pattern (about, services, pricing, contact), fetch at reduced truncation (~3–4k chars each). Route different page combinations to different agents — not every agent needs every page. Watch token costs: each additional page amplifies across all 5 parallel calls.
  _Effort: M | Impact: H_

---

### Access & Monetization

- [x] **Invite code + run limit**
  Invite code field on landing page — valid codes in env var, checked server-side. Code stored in localStorage so re-entry isn't required. Each audit increments a localStorage counter; at N runs (e.g. 5) show a "complimentary audits used" message with a contact/upgrade CTA. Counter is bypassable but sufficient for demo-stage metering — anyone motivated enough to clear localStorage is a warm lead.
  _Status: Shipped — `INVITE_CODES` env var (comma-separated), `RUN_LIMIT = 5` in `page.tsx`, gate screen with contact CTA_

- [ ] **Stripe paywall**
  Natural successor to the run limit. Stripe Payment Link (no-code) for an audit pack (e.g. 10 audits / $49). On checkout success, issue a redemption token to localStorage and lift the gate. No backend payment logic required — Stripe hosts the checkout page.
  _Effort: M | Impact: H (commercial)_

---

### UX / Product

- [ ] **Saved audit history** (localStorage or DB)
  Results disappear on refresh currently. localStorage is a quick win; Vercel Postgres/Supabase for multi-session.
  _Effort: S–M | Impact: M_

- [ ] **Side-by-side competitor audit**
  Run the same audit on a competitor URL and display results in parallel columns. Natural upsell conversation starter.
  _Effort: M | Impact: H_

- [x] **Data sources panel in UI**
  Show what's connected vs. available per audit. Visual representation of the tier model — makes the upsell implicit.
  _Status: Shipped — `DataSourcesPanel.tsx`, shows Active / Available / Roadmap sections with connect modals_

- [ ] **Model selector toggle**
  Let agency staff switch between Haiku (fast/cheap), Sonnet (default), Opus (deep analysis) from the UI.
  _Effort: S | Impact: M_

- [ ] **White-label / client branding**
  Agency name + logo in header, custom color scheme. Required for client-facing delivery.
  _Effort: M | Impact: H (commercial)_
