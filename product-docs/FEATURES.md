# Features & Capabilities

## Core Features

### Five-Dimension Audit
Enter a URL, receive a structured analysis across five specialist lenses running in parallel:

| Dimension | Weight | What It Covers |
|---|---|---|
| Content & Messaging | 25% | Headline clarity, value prop strength, copy persuasion, CTAs |
| Conversion Optimization | 20% | Funnel friction, social proof, trust signals, urgency |
| SEO & Discoverability | 20% | Page structure, Core Web Vitals, tracking setup, schema |
| Brand & Growth Strategy | 20% | Brand consistency, trust architecture, acquisition channels |
| Competitive Positioning | 15% | Differentiation clarity, market awareness, content authority |

A composite score (0–100) is computed as a weighted average. Qualitative labels (Critical / Weak / Fair / Good / Strong) map to score bands for non-technical audiences.

### Auditor Identity Collection
Before running an audit, users enter their name (required) and company (optional). These appear in Discord notifications and the server-side audit log — they're the primary signal for understanding who is using the tool and when.

### Real-Time Streaming Results
The five agents fire in parallel and stream results back via SSE as they complete. Each agent card updates independently — users see partial results as they arrive rather than waiting for all five to finish.

### Lighthouse / PageSpeed Integration
The technical agent receives real Google PageSpeed Insights data (not inferred): Performance, Accessibility, SEO, Best Practices scores, plus LCP, CLS, TBT, FCP, Speed Index, and TTI. Falls back to unauthenticated requests when no API key is present.

### Downloadable Markdown Report
After audit completion, users can download a structured `.md` file containing all agent findings, scores, and recommendations. Filename is `marketing-audit-{domain}.md`. Intended as a pitch closer — something to hand to the client at the end of a screen share.

### Data Sources Panel
Post-audit panel shows which data sources were active in this audit and which are available at higher service tiers. Organized into three tiers (Standard / Connected / Agency). The upsell is embedded in the product: the gap between "what we analyzed" and "what richer data would unlock" is visible on every audit.

### Connected Data (GA4 + Search Console)
A GCP service account authenticates to Google APIs server-side. No user OAuth flow — when a client adds the service account as a Viewer on their GA4 property and Search Console property, data loads automatically for every subsequent audit of that domain. The audit route calls `/api/connected-data` on every run; if the service account has access, enriched context is injected into the relevant agents. If not, the audit runs Standard tier silently.

### Discord Webhook Notifications
Two Discord events fire per audit. A start ping fires immediately with the auditor's name, company, and URL — before any fetch begins. A completion embed fires after all agents finish, with composite score, per-agent scores, PageSpeed data, token counts, and estimated cost. Both are fire-and-forget.

### Token Usage Tracking
A run stats bar displays after each audit: model used, duration, total tokens consumed, and estimated USD cost. Per-agent token usage is tracked and aggregated.

---

## Out of Scope

- **End-user accounts**: No login, no saved profiles. The tool has no user authentication layer.
- **Multi-page crawling**: Analysis is limited to the homepage URL provided.
- **Client-side audit history**: Results disappear on refresh. Server-side logging exists (see below), but nothing is returned to the browser for history views.
- **White-labeling**: The tool is currently unbranded (agency name / logo not configurable).

---

## Known Limitations

- **Homepage-only**: Agents analyze only the fetched homepage HTML (truncated to 15k chars). Interior pages, blog posts, and landing pages are not analyzed.
- **Inference-heavy without connected data**: At the Standard tier, agents infer tracking setup, competitor landscape, and traffic channels from HTML signals only. Real data (GA4, GSC) materially improves accuracy for several agents.
- **No client-side persistence**: Results are lost on page refresh. Server-side logs capture every completed audit (human-readable `logs/audit.log` and structured `logs/audit-data.jsonl`), but nothing is queryable or surfaced back to users.
- **Rate-limited PageSpeed**: Without a Google API key, PageSpeed calls hit the unauthenticated rate limit — may degrade under concurrent load.
- **Single-threaded UI**: Only one audit can run at a time per browser session.
- **Connected tier requires manual client setup**: The service account model eliminates the OAuth flow for the operator, but clients must manually add `digital-audit@marketing-audit-492917.iam.gserviceaccount.com` as a Viewer in their GA4 and Search Console properties. One-time, two-minute task — but it's still a manual concierge step.
