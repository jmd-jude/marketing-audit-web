# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Marketing Intelligence — Claude Code Context

## What This Is

A Next.js web app that wraps AI marketing analysis in a browser UI, abstracting away Claude Code entirely for non-technical end users. Built as a pitch/demo tool for a boutique marketing agencies exploring digital service expansion or SMB's without resources to hire and retain digital marketing agencies. The "wizard of oz" framing is intentional — it should feel like a polished product, not a developer tool.

**Strategic context:** This tool demonstrates that digital marketing analysis (which previously required hiring a team) can be delivered as a value-added service layer on top of existing agency engagement scopes, or direct to SMB's

## Architecture

- **Framework:** Next.js 16 with App Router, TypeScript, Tailwind CSS
- **API runtime:** Edge (Vercel Edge Functions) — required for SSE streaming
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — 5 parallel `messages.create` calls per audit
- **Database:** Neon Postgres (`@neondatabase/serverless`) — every completed audit persisted as a row
- **Deployment target:** Vercel

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Single-page UI — landing, simplified progress state, teaser-only done state (score + verdict + top 3 priorities + "full report coming" close) |
| `app/audit/[id]/page.tsx` | Server component — fetches audit row from Neon by UUID, passes to client |
| `app/audit/[id]/AuditReport.tsx` | Client component — renders shareable report page (canonical full-report destination) |
| `app/api/audit/route.ts` | Edge API route — fetches page content via Firecrawl (or raw HTML fallback) + PageSpeed + interior pages, runs 5 agents in parallel via SSE |
| `app/api/log/route.ts` | Node runtime route — writes to audit.log, audit-data.jsonl, and Neon Postgres; also fires the Discord completion embed (moved here from the Edge route so it can be properly awaited) |
| `app/api/connected-data/route.ts` | Node runtime route — fetches GSC + GA4 data using service account auth, returns formatted context strings |
| `app/api/competitive-data/route.ts` | Node runtime route — fetches DataForSEO Labs data: `domain_rank_overview/live`, `competitors_domain/live`, `ranked_keywords/live` (positions 4–20, sorted by volume desc). Returns `{ rankContext, competitorsContext, keywordsContext }`. |
| `app/api/gate/route.ts` | Node runtime route — receives email capture from gate card, fires Discord with pre-built `?full=1` URL |
| `app/api/admin/audits/route.ts` | Node runtime route — internal admin access to audit records |
| `app/api/auth/` | Stubbed OAuth routes (410 Gone) — no longer active, kept to avoid 404s |
| `app/sample/page.tsx` | Server component — renders a pre-unlocked full report using `SAMPLE_AUDIT_ID`; 404 if env var unset |
| `lib/agents.ts` | All 5 agent system prompts + weights config |
| `lib/gsc-ga4.ts` | Service account auth, GSC + GA4 API calls, GA4 property discovery, context formatters |
| `scripts/setup-db.ts` | One-time Neon table creation |
| `scripts/test-dataforseo.ts` | Utility for debugging DataForSEO API calls |
| `logs/viewer.html` | Internal audit explorer — load audit-data.jsonl to page through runs |
| `public/job-xray.html` | Internal per-agent inspector — tabs for Analyst Job, Data In (rendered markdown), Raw Output, Formatted Report |
| `product-docs/ROADMAP.md` | Product backlog |
| `product-docs/ARCHITECTURE.md` | System architecture diagrams — current state, full vision, and direct mail parallel |

## How the Audit Works

1. User enters name, company (optional), and URL → `GET /api/audit?url=...&name=...&company=...`
2. Discord **start ping** fires immediately (name + company + URL)
3. API fetches page content via Firecrawl (returns clean markdown + structured metadata; falls back to raw HTML fetch if `FIRECRAWL_API_KEY` is unset), Google PageSpeed data, robots.txt/sitemap, GSC/GA4 via `/api/connected-data`, and DataForSEO competitive data via `/api/competitive-data` — all in parallel
4. Page metadata extracted: title, description, OG tags, canonical, H1s (parsed from markdown), word count, generator field (e.g. "Wix.com Website Builder"). With Firecrawl this comes from the structured metadata response; without it, regex against raw HTML.
4a. Links extracted from Firecrawl's `links` array (same-domain filtered) or regex against raw HTML. Up to 3 interior pages selected by `PAGE_CONFIG` scoring and fetched in parallel (8s timeout, 3k char truncation each). Each page is routed to the agents it benefits — technical agent receives none.
5. 5 Claude API calls fire simultaneously. DataForSEO `rankContext` → technical + strategy agents. DataForSEO `competitorsContext` → competitive + strategy agents.
6. Results stream back to the browser via SSE (`text/event-stream`)
7. `page.tsx` renders a simplified progress state (spinner + status + "N of 5 complete" bar). No live agent cards.
8. `writeAuditLog` (Neon INSERT) runs and completes **before** the `complete` SSE event is sent — ensures the report page has full data the moment the browser navigates to it.
9. On `complete`, `page.tsx` shows teaser: score, overall verdict, top 3 priorities (findings + impact only, no actions). A "full report ready" card closes the page.
10. Discord **completion embed** fires with score + tokens + a direct link to `/audit/{id}` for Jude to review and share
11. Full report lives at `/audit/[id]` — server-rendered from Neon, shareable URL. Jude sends this link to the prospect at his timing.

## Agent Weights

| Agent | Key | Weight |
|---|---|---|
| Content & Messaging | `content` | 25% |
| Conversion Optimization | `conversion` | 20% |
| SEO & Technical | `technical` | 20% |
| Brand & Growth Strategy | `strategy` | 20% |
| Competitive Positioning | `competitive` | 15% |

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic console |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `DISCORD_WEBHOOK_URL` | No | Start ping + completion notifications — points at #digital-marketing-audit-poc channel |
| `GOOGLE_PAGESPEED_API_KEY` | No | Falls back to unauthenticated (rate-limited) |
| `INVITE_CODES` | No | Comma-separated list of valid invite codes. Gates running an audit. If unset, gate is disabled (dev mode). |
| `NEXT_PUBLIC_UNLOCK_CODES` | No | Deprecated — no longer used. Gate model changed to email capture + manual delivery. |
| `SAMPLE_AUDIT_ID` | No | UUID of the audit to show at `/sample`. If unset, `/sample` returns 404. |
| `DATABASE_URL` | Yes (for persistence) | Neon Postgres pooled connection string. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | When Google APIs connected | Full JSON key file contents as a **single line** — use `python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)))" < key.json` to collapse the file before pasting. Literal newlines in the value break `JSON.parse`. Service account in GCP `marketing-audit` project. |
| `DATAFORSEO_LOGIN` | When DataForSEO connected | DataForSEO API login (from dashboard, not account password). |
| `DATAFORSEO_PASSWORD` | When DataForSEO connected | DataForSEO API password. |
| `FIRECRAWL_API_KEY` | Recommended | Firecrawl API key. When set, replaces raw HTML fetch with clean markdown + structured metadata for homepage and interior pages. Falls back to raw fetch if unset. |

## Development

```bash
npm run dev       # local dev server on port 3001
npm run build     # production build (run before deploying)
npm run lint      # ESLint
npx tsx scripts/setup-db.ts     # one-time: create Neon audits table
npx tsx scripts/test-dataforseo.ts  # debug DataForSEO API calls
```

## Data Sources

Data source provenance is surfaced lightly in the report via the "What We Analyzed" section.

**Standard:** Page content (Firecrawl markdown when key present, raw HTML fallback) + PageSpeed Insights — always runs, no auth  
**Connected (shipped):** GA4 + Search Console via service account — always-on, no session required. Data loads automatically when access has been granted. GA4 now includes `conversionsBySourceMedium` (sessionSourceMedium dimension + conversion metrics) in addition to the channel-level conversions.  
**Professional (shipped — Labs only):** Three parallel DataForSEO Labs endpoints via `/api/competitive-data`: `domain_rank_overview/live` (organic traffic, keyword counts, momentum), `competitors_domain/live` (top 10 competitors by keyword overlap), and `ranked_keywords/live` (positions 4–20, top 25 by search volume). `rankContext` → technical + strategy + competitive agents. `competitorsContext` → competitive + strategy + content agents. `keywordsContext` → technical + strategy agents. Backlinks API deprioritized (requires $100 minimum commitment). Graceful degradation if credentials missing.  
**Agency (roadmap):** SEMrush/Ahrefs, Klaviyo, Meta Ads API, if not available at dataforseo

See `product-docs/ROADMAP.md` for full backlog.

## Service Account

- **Model:** A GCP service account (`digital-audit@marketing-audit-492917.iam.gserviceaccount.com`) authenticates to Google APIs. No OAuth flow, no session cookies, no user-facing connect step.
- **Client setup:** Client adds the service account email as a Viewer on their GA4 property (Admin → Account Access Management) and as a Full User on their Search Console property (Settings → Users and Permissions). One-time, takes 2 minutes.
- **Always-on:** The audit route always calls `/api/connected-data`. If the service account has access to the audited URL's property, data comes back and enriches the audit. If not, the route returns `{ gscContext: null, ga4Context: null }` and the audit runs without that data.
- **Edge runtime constraint:** The audit route runs on Edge (required for SSE streaming). The `googleapis` SDK uses Node.js modules incompatible with Edge. GSC/GA4 fetching is delegated to `/api/connected-data` (Node runtime), which returns formatted strings the Edge audit route consumes.
- **GA4 property discovery:** At request time, `discoverGa4PropertyId(domain)` lists all accessible GA4 properties and finds the best match. No stored session — discovery runs per audit.
- **`connected` flag in SSE:** The `fetched` event sends `connected: true` only if gscContext or ga4Context was actually returned. `DataSourcesPanel` derives active/available state from this.
- **Scopes:** `webmasters.readonly` (GSC) + `analytics.readonly` (GA4) — read-only only.

## Conventions

- Agent system prompts live in `lib/agents.ts` — this is the primary tuning surface. Adjusting prompt language, scoring rubrics, and output structure happens here.
- The API route (`app/api/audit/route.ts`) handles all data fetching and orchestration. Agent prompts should not contain fetch logic — context is passed in via `additionalContext` parameter.
- All agent output is JSON only — prompts explicitly instruct the model not to wrap in markdown. The route strips fences defensively.
- PageSpeed data is passed only to the technical agent. Other agents receive page content only.
- Page content passed to agents is clean markdown when Firecrawl is active, stripped HTML otherwise. The user message label is "Page content:" (not "Page HTML content:") in both cases.
- Interior page content is routed per `PAGE_CONFIG` in `route.ts` — pricing/contact go to conversion+competitive, about goes to strategy+content, services goes to competitive+content+strategy. Technical agent intentionally excluded. Content injected as `## Interior Page: /path` sections in `additionalContext`.
- Interior page fetches use `Promise.allSettled` with an 8s timeout per page (bumped from 4s to accommodate Firecrawl headless rendering). A timeout or error on any page doesn't fail the audit — that page simply doesn't contribute. Zero interior pages is a valid outcome.
- `pagesAnalyzed` is included in the `fetched` SSE event and in the `writeAuditLog` payload (queryable via `payload->'pagesAnalyzed'` in Postgres). The Data Sources panel surfaces fetched page paths when expanded.
- www/non-www mismatch in hrefs is handled in `filterSameDomainLinks` (Firecrawl path) and `extractLinks` (fallback path) — both normalize by stripping `www.` before comparing hostnames.
- Discord has two events: `notifyDiscordStart` (fires before fetch from the Edge route, includes name + company + URL) and the completion embed (fires from `/api/log` Node route after the Neon write, includes score + tokens + report link). The completion embed was moved out of the Edge route because Vercel terminates the Edge execution context when the stream closes, killing any in-flight outbound requests. The gate route (`/api/gate`) also fires Discord on email capture — that fetch must be `await`ed before the 204 returns or the serverless function exits before it completes.
- The audit route always calls `/api/connected-data?siteUrl=...` before launching agents. The response is `{ gscContext: string | null, ga4Context: string | null }`. GSC context goes to `technical`, `strategy`, `competitive`, `content` agents. GA4 context goes to all five. GA4 context includes `conversionsBySourceMedium` (source/medium grain conversion chain) when conversions exist.
- Token usage is tracked per-agent via `message.usage` and aggregated into the `complete` SSE event. Displayed in the run stats bar and Discord embed.
- `extractPageMetadata` is used only on the raw HTML fallback path. On the Firecrawl path, `metadataFromFirecrawl` maps the Firecrawl metadata response to `PageMetadata` — H1s are parsed from markdown headings, word count from the markdown body, `generator` field carries CMS detection (e.g. "Wix.com Website Builder").
- Name and company are passed as query params (`?name=&company=`). Company is optional; name is required by the UI but defaults to `'Unknown'` server-side if missing.
- Every completed audit is persisted to Neon Postgres via `writeAuditLog`. This runs **before** the `complete` SSE event fires so the report page always has full data on first load. The log route writes to JSONL file + Postgres.
- Gate model on `/audit/[id]`: free zone (score, assessment, provenance, all 5 findings without action steps) is always visible. Full report (priority actions, quick wins, agent deep-dives in tabs) requires unlock. Unlock is triggered by `?full=1` in the URL — operator sends `https://…/audit/[id]?full=1` to the prospect after receiving their email via Discord. Email capture fires `POST /api/gate` which pings Discord with email + the pre-built `?full=1` URL. Prospect sees a confirmation state ("We'll send your report shortly") — not instant unlock.
- `INVITE_CODES` (server-side) still gates running an audit. `NEXT_PUBLIC_UNLOCK_CODES` is deprecated and unused.
- `/sample` page renders a full unlocked report for `SAMPLE_AUDIT_ID`. Linked from the gate card so free-zone viewers can see what the full report looks like before requesting their own.

## What Not to Do

- Do not change `export const runtime = 'edge'` in the API route — SSE streaming requires edge runtime on Vercel
- Do not add server-side state or database calls to the API route without confirming Vercel Edge compatibility
- Do not hardcode model names — always read from `process.env.ANTHROPIC_MODEL`
- Do not increase the homepage content truncation limit (currently 15k chars) without load-testing token costs — 5 parallel calls amplify fast
- Do not increase the interior page truncation limit (currently 3k chars) without considering that up to 3 pages are routed to up to 4 agents simultaneously — cost amplifies fast. Firecrawl markdown is denser signal than stripped HTML so the limit is more meaningful now, but still enforce it.
- Do not set `maxAge` > 0 on Firecrawl calls — a cached page from 2 days ago would silently produce stale audit results
