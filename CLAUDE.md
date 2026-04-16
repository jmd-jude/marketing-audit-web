# Marketing Intelligence — Claude Code Context

## What This Is

A Next.js web app that wraps AI marketing analysis in a browser UI, abstracting away Claude Code entirely for non-technical end users. Built as a pitch/demo tool for a boutique direct mail agency exploring digital service expansion. The "wizard of oz" framing is intentional — it should feel like a polished product, not a developer tool.

**Strategic context:** The agency's target clients are traditional direct mail / catalog marketers. This tool demonstrates that digital marketing analysis (which previously required hiring a team) can now be delivered as a value-added service layer on top of existing engagement scopes.

## Architecture

- **Framework:** Next.js 16 with App Router, TypeScript, Tailwind CSS
- **API runtime:** Edge (Vercel Edge Functions) — required for SSE streaming
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — 5 parallel `messages.create` calls per audit
- **Database:** Neon Postgres (`@neondatabase/serverless`) — every completed audit persisted as a row
- **Deployment target:** Vercel

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Single-page UI — landing, audit progress, teaser/unlock results |
| `app/audit/[id]/page.tsx` | Server component — fetches audit row from Neon by UUID, passes to client |
| `app/audit/[id]/AuditReport.tsx` | Client component — renders shareable teaser/unlock report page |
| `app/api/audit/route.ts` | Edge API route — fetches HTML + PageSpeed, runs 5 agents in parallel via SSE |
| `app/api/log/route.ts` | Node runtime route — writes to audit.log, audit-data.jsonl, and Neon Postgres |
| `app/api/connected-data/route.ts` | Node runtime route — fetches GSC + GA4 data using service account auth, returns formatted context strings |
| `app/api/auth/` | Stubbed OAuth routes (410 Gone) — no longer active, kept to avoid 404s |
| `lib/agents.ts` | All 5 agent system prompts + weights config |
| `lib/gsc-ga4.ts` | Service account auth, GSC + GA4 API calls, GA4 property discovery, context formatters |
| `components/DataSourcesPanel.tsx` | Data sources tier UI (active / available / roadmap) |
| `scripts/setup-db.ts` | One-time Neon table creation — run with `npx tsx scripts/setup-db.ts` |
| `logs/viewer.html` | Internal audit explorer — load audit-data.jsonl to page through runs |
| `product-docs/ROADMAP.md` | Product backlog and tier model |
| `product-docs/ARCHITECTURE.md` | System architecture diagrams — current state, full vision, and direct mail parallel |

## How the Audit Works

1. User enters name, company (optional), and URL → `GET /api/audit?url=...&name=...&company=...`
2. Discord **start ping** fires immediately (name + company + URL)
3. API fetches page HTML (truncated to 15k chars), Google PageSpeed data, robots.txt/sitemap, **and GSC/GA4 via service account** — all in parallel
4. Page metadata extracted from raw HTML before stripping (title, meta description, canonical, H1s, word count, structured data, OG tags)
5. 5 Claude API calls fire simultaneously (one per agent), each receiving the HTML + PageSpeed data (technical agent only for PageSpeed)
6. Results stream back to the browser via SSE (`text/event-stream`)
7. Each agent card updates in real-time as responses complete
8. Composite score = weighted average across 5 dimensions
9. Discord **completion embed** fires with name + company + score + token stats
10. PageSpeed data surfaces in the technical agent card as a 4-pill Lighthouse score strip
11. Data Inputs panel shows extracted page metadata (collapses, starts open)

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
| `NEXT_PUBLIC_UNLOCK_CODES` | No | Comma-separated list of unlock codes. Gates full report reveal on both `page.tsx` and `/audit/[id]`. Client-side only — intentionally bypassable. |
| `DATABASE_URL` | Yes (for persistence) | Neon Postgres pooled connection string. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Connected tier | Full JSON key file contents (paste as one line). Service account in GCP `marketing-audit` project. |

## Development

```bash
npm run dev       # local dev server
npm run build     # production build (run before deploying)
npm run lint      # ESLint
```

## Data Sources & Tier Model

The `DataSourcesPanel` component renders post-audit showing what data sources were used and what's available at higher service tiers. This is intentional product design — the upsell is embedded in the UI.

**Standard:** Page HTML + PageSpeed Insights — always runs, no auth  
**Connected (shipped):** GA4 + Search Console via service account — always-on, no session required. Data loads automatically when access has been granted.  
**Agency (roadmap):** SEMrush/Ahrefs, Klaviyo, Meta Ads API  

See `product-docs/ROADMAP.md` for full backlog.

## Service Account / Connected Tier Architecture

- **Model:** A GCP service account (`digital-audit@marketing-audit-492917.iam.gserviceaccount.com`) authenticates to Google APIs. No OAuth flow, no session cookies, no user-facing connect step.
- **Client setup:** Client adds the service account email as a Viewer on their GA4 property (Admin → Account Access Management) and as a Full User on their Search Console property (Settings → Users and Permissions). One-time, takes 2 minutes.
- **Always-on:** The audit route always calls `/api/connected-data`. If the service account has access to the audited URL's property, data comes back and enriches the audit. If not, the route returns `{ gscContext: null, ga4Context: null }` and the audit runs Standard tier silently.
- **Edge runtime constraint:** The audit route runs on Edge (required for SSE streaming). The `googleapis` SDK uses Node.js modules incompatible with Edge. GSC/GA4 fetching is delegated to `/api/connected-data` (Node runtime), which returns formatted strings the Edge audit route consumes.
- **GA4 property discovery:** At request time, `discoverGa4PropertyId(domain)` lists all accessible GA4 properties and finds the best match. No stored session — discovery runs per audit.
- **`connected` flag in SSE:** The `fetched` event sends `connected: true` only if gscContext or ga4Context was actually returned. `DataSourcesPanel` derives active/available state from this.
- **Scopes:** `webmasters.readonly` (GSC) + `analytics.readonly` (GA4) — read-only only.

## Conventions

- Agent system prompts live in `lib/agents.ts` — this is the primary tuning surface. Adjusting prompt language, scoring rubrics, and output structure happens here.
- The API route (`app/api/audit/route.ts`) handles all data fetching and orchestration. Agent prompts should not contain fetch logic — context is passed in via `additionalContext` parameter.
- All agent output is JSON only — prompts explicitly instruct the model not to wrap in markdown. The route strips fences defensively.
- PageSpeed data is passed only to the technical agent. Other agents receive HTML only.
- Discord has two events: `notifyDiscordStart` (fires before fetch, includes name + company + URL) and `notifyDiscord` (fires after completion, includes score + tokens). Both are fire-and-forget — never block the SSE stream on either.
- The audit route always calls `/api/connected-data?siteUrl=...` before launching agents. The response is `{ gscContext: string | null, ga4Context: string | null }`. GSC context goes to `technical`, `strategy`, `competitive`, `content` agents. GA4 context goes to all five.
- Token usage is tracked per-agent via `message.usage` and aggregated into the `complete` SSE event. Displayed in the run stats bar and Discord embed.
- `extractPageMetadata` runs on raw HTML before stripping — must run before `fetchPageContent` strips scripts/styles or metadata regex will still work but word count will be inflated by JS. Currently correct: metadata extracted inside `fetchPageContent` on the raw response.
- Name and company are passed as query params (`?name=&company=`). Company is optional; name is required by the UI but defaults to `'Unknown'` server-side if missing.
- Every completed audit is persisted to Neon Postgres via a fire-and-forget POST to `/api/log`. The `complete` SSE event includes `auditId` (UUID). The log route writes to JSONL file + Postgres in parallel.
- Two-code gate model: `INVITE_CODES` (server-side, gates running) and `NEXT_PUBLIC_UNLOCK_CODES` (client-side, gates full report reveal). During `running` phase all agent output streams live. On `done`, results switch to teaser mode until unlock code is entered.
- The shareable `/audit/[id]` page fetches from Neon server-side and renders the same teaser/unlock UX using the same `NEXT_PUBLIC_UNLOCK_CODES` pool.

## What Not to Do

- Do not change `export const runtime = 'edge'` in the API route — SSE streaming requires edge runtime on Vercel
- Do not add server-side state or database calls to the API route without confirming Vercel Edge compatibility
- Do not hardcode model names — always read from `process.env.ANTHROPIC_MODEL`
- Do not increase the HTML truncation limit (currently 15k chars) without load-testing token costs — 5 parallel calls amplify fast
