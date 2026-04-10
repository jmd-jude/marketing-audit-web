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

### Real-Time Streaming Results
The five agents fire in parallel and stream results back via SSE as they complete. Each agent card updates independently — users see partial results as they arrive rather than waiting for all five to finish.

### Lighthouse / PageSpeed Integration
The technical agent receives real Google PageSpeed Insights data (not inferred): Performance, Accessibility, SEO, Best Practices scores, plus LCP, CLS, TBT, and FCP values. Falls back to unauthenticated requests when no API key is present.

### Downloadable Markdown Report
After audit completion, users can download a structured `.md` file containing all agent findings, scores, and recommendations. Filename is `marketing-audit-{domain}.md`. Intended as a pitch closer — something to hand to the client at the end of a screen share.

### Data Sources Panel
Post-audit panel shows which data sources were used in this audit and which are available to connect for richer analysis. Organized into three tiers (Standard / Connected / Agency). The upsell is embedded in the product: clicking "Connect" on GA4 or Search Console shows the integration flow and surfaces the tier upgrade path.

### Discord Webhook Notifications
On audit completion, a Discord embed fires with the URL, composite score, model used, token counts (per-agent and total), and estimated cost. Fire-and-forget — never blocks the user-facing stream.

### Token Usage Tracking
A run stats bar displays after each audit: model used, duration, total tokens consumed, and estimated USD cost. Per-agent token usage is tracked and aggregated.

---

## Out of Scope

- **User accounts / auth**: No login, no saved profiles. Each audit is stateless.
- **Multi-page crawling**: Analysis is limited to the homepage URL provided.
- **Historical comparison**: No audit history or trend tracking (localStorage/DB is on the roadmap, not built).
- **White-labeling**: The tool is currently unbranded (agency name / logo not configurable).
- **Live connected integrations**: GA4, Search Console, and paid tool APIs are in the UI as "coming soon" — the connection flows are not functional yet.

---

## Known Limitations

- **Homepage-only**: Agents analyze only the fetched homepage HTML (truncated to 15k chars). Interior pages, blog posts, and landing pages are not analyzed.
- **Inference-heavy without connected data**: At the Standard tier, agents infer tracking setup, competitor landscape, and traffic channels from HTML signals only. Real data (GA4, GSC) would materially improve accuracy for several agents.
- **No audit persistence**: Results are lost on page refresh. No localStorage or database backing.
- **Rate-limited PageSpeed**: Without a Google API key, PageSpeed calls hit the unauthenticated rate limit — may degrade under concurrent load.
- **Single-threaded UI**: Only one audit can run at a time per browser session.
