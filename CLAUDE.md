# Marketing Intelligence — Claude Code Context

## What This Is

A Next.js web app that wraps AI marketing analysis in a browser UI, abstracting away Claude Code entirely for non-technical end users. Built as a pitch/demo tool for a boutique direct mail agency exploring digital service expansion. The "wizard of oz" framing is intentional — it should feel like a polished product, not a developer tool.

**Strategic context:** The agency's target clients are traditional direct mail / catalog marketers. This tool demonstrates that digital marketing analysis (which previously required hiring a team) can now be delivered as a value-added service layer on top of existing engagement scopes.

## Architecture

- **Framework:** Next.js 16 with App Router, TypeScript, Tailwind CSS
- **API runtime:** Edge (Vercel Edge Functions) — required for SSE streaming
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — 5 parallel `messages.create` calls per audit
- **Deployment target:** Vercel

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Single-page UI — landing, audit progress, results |
| `app/api/audit/route.ts` | Edge API route — fetches HTML + PageSpeed, runs 5 agents in parallel via SSE |
| `app/api/auth/connect/route.ts` | Builds Google OAuth URL, sets CSRF state cookie, redirects |
| `app/api/auth/callback/route.ts` | Exchanges OAuth code for tokens, discovers GA4 property ID, sets encrypted session cookie |
| `app/api/auth/status/route.ts` | Returns `{ connected: true/false }` for UI state |
| `app/api/auth/disconnect/route.ts` | Clears session cookie |
| `app/api/connected-data/route.ts` | Node runtime route — fetches GSC + GA4 data using googleapis, returns formatted context strings |
| `lib/agents.ts` | All 5 agent system prompts + weights config |
| `lib/gsc-ga4.ts` | OAuth helpers, GSC + GA4 API calls, GA4 property discovery, context formatters |
| `components/DataSourcesPanel.tsx` | Data sources tier UI (active / available / roadmap) |
| `product-docs/ROADMAP.md` | Product backlog and tier model |
| `product-docs/ARCHITECTURE.md` | System architecture diagrams — current state, full vision, and direct mail parallel |

## How the Audit Works

1. User enters name, company (optional), and URL → `GET /api/audit?url=...&name=...&company=...`
2. Discord **start ping** fires immediately (name + company + URL)
3. API fetches page HTML (truncated to 15k chars), Google PageSpeed data, and robots.txt/sitemap **in parallel**
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
| `INVITE_CODES` | No | Comma-separated list of valid invite codes. If unset, gate is disabled (dev mode). |
| `GOOGLE_CLIENT_ID` | Connected tier | GCP OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Connected tier | GCP OAuth 2.0 client secret — never expose client-side |
| `GOOGLE_REDIRECT_URI` | Connected tier | Must match GCP exactly — e.g. `https://yourdomain.com/api/auth/callback` |
| `SESSION_SECRET` | Connected tier | `openssl rand -hex 32` — encrypts the JWT session cookie |

## Development

```bash
npm run dev       # local dev server
npm run build     # production build (run before deploying)
npm run lint      # ESLint
```

## Data Sources & Tier Model

The `DataSourcesPanel` component renders post-audit showing what data sources were used and what's available at higher service tiers. This is intentional product design — the upsell is embedded in the UI.

**Standard:** Page HTML + PageSpeed Insights — always runs, no auth  
**Connected (shipped):** GA4 + Search Console via OAuth — operator connects their own Google account, which must have viewer access to the client's properties  
**Agency (roadmap):** SEMrush/Ahrefs, Klaviyo, Meta Ads API  

See `product-docs/ROADMAP.md` for full backlog.

## OAuth / Connected Tier Architecture

- **Operator model:** The operator (you) connects *your* Google account via OAuth. Clients add your Google account as a Viewer on their GSC property and GA4 account. No client-facing auth flow.
- **GCP setup:** One-time. OAuth app lives in the `marketing-audit` GCP project. App is in Testing mode — operator's Google account is the only user, no verification required.
- **Session storage:** Encrypted JWT in an HttpOnly cookie (`goog_session`). 24-hour TTL. No database.
- **Edge runtime constraint:** The audit route runs on Edge (required for SSE streaming). The `googleapis` SDK uses Node.js modules incompatible with Edge. GSC/GA4 fetching is delegated to `/api/connected-data` (Node runtime), which returns formatted strings the Edge audit route consumes.
- **GA4 property discovery:** At OAuth callback time, `discoverGa4PropertyId()` lists all accessible GA4 properties and stores the best match in the session JWT. The audit route uses this stored ID — no runtime lookup.
- **Scopes:** `webmasters.readonly` (GSC) + `analytics.readonly` (GA4) — read-only only.

## Conventions

- Agent system prompts live in `lib/agents.ts` — this is the primary tuning surface. Adjusting prompt language, scoring rubrics, and output structure happens here.
- The API route (`app/api/audit/route.ts`) handles all data fetching and orchestration. Agent prompts should not contain fetch logic — context is passed in via `additionalContext` parameter.
- All agent output is JSON only — prompts explicitly instruct the model not to wrap in markdown. The route strips fences defensively.
- PageSpeed data is passed only to the technical agent. Other agents receive HTML only.
- Discord has two events: `notifyDiscordStart` (fires before fetch, includes name + company + URL) and `notifyDiscord` (fires after completion, includes score + tokens). Both are fire-and-forget — never block the SSE stream on either.
- When OAuth is connected, the audit route calls `/api/connected-data?siteUrl=...` (forwarding the session cookie) before launching agents. The response is `{ gscContext: string | null, ga4Context: string | null }`. GSC context goes to `technical`, `strategy`, `competitive`, `content` agents. GA4 context goes to all five.
- Token usage is tracked per-agent via `message.usage` and aggregated into the `complete` SSE event. Displayed in the run stats bar and Discord embed.
- `extractPageMetadata` runs on raw HTML before stripping — must run before `fetchPageContent` strips scripts/styles or metadata regex will still work but word count will be inflated by JS. Currently correct: metadata extracted inside `fetchPageContent` on the raw response.
- Name and company are passed as query params (`?name=&company=`). Company is optional; name is required by the UI but defaults to `'Unknown'` server-side if missing.

## What Not to Do

- Do not change `export const runtime = 'edge'` in the API route — SSE streaming requires edge runtime on Vercel
- Do not add server-side state or database calls to the API route without confirming Vercel Edge compatibility
- Do not hardcode model names — always read from `process.env.ANTHROPIC_MODEL`
- Do not increase the HTML truncation limit (currently 15k chars) without load-testing token costs — 5 parallel calls amplify fast
