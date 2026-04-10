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
| `lib/agents.ts` | All 5 agent system prompts + weights config |
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

## Development

```bash
npm run dev       # local dev server
npm run build     # production build (run before deploying)
npm run lint      # ESLint
```

## Data Sources & Tier Model

The `DataSourcesPanel` component renders post-audit showing what data sources were used and what's available at higher service tiers. This is intentional product design — the upsell is embedded in the UI.

**Standard (current):** Page HTML + PageSpeed Insights — always runs, no auth  
**Connected (roadmap):** GA4 + Search Console via OAuth service account grant  
**Agency (roadmap):** SEMrush/Ahrefs, Klaviyo, Meta Ads API  

See `product-docs/ROADMAP.md` for full backlog.

## Conventions

- Agent system prompts live in `lib/agents.ts` — this is the primary tuning surface. Adjusting prompt language, scoring rubrics, and output structure happens here.
- The API route (`app/api/audit/route.ts`) handles all data fetching and orchestration. Agent prompts should not contain fetch logic — context is passed in via `additionalContext` parameter.
- All agent output is JSON only — prompts explicitly instruct the model not to wrap in markdown. The route strips fences defensively.
- PageSpeed data is passed only to the technical agent. Other agents receive HTML only.
- Discord has two events: `notifyDiscordStart` (fires before fetch, includes name + company + URL) and `notifyDiscord` (fires after completion, includes score + tokens). Both are fire-and-forget — never block the SSE stream on either.
- Token usage is tracked per-agent via `message.usage` and aggregated into the `complete` SSE event. Displayed in the run stats bar and Discord embed.
- `extractPageMetadata` runs on raw HTML before stripping — must run before `fetchPageContent` strips scripts/styles or metadata regex will still work but word count will be inflated by JS. Currently correct: metadata extracted inside `fetchPageContent` on the raw response.
- Name and company are passed as query params (`?name=&company=`). Company is optional; name is required by the UI but defaults to `'Unknown'` server-side if missing.

## What Not to Do

- Do not change `export const runtime = 'edge'` in the API route — SSE streaming requires edge runtime on Vercel
- Do not add server-side state or database calls to the API route without confirming Vercel Edge compatibility
- Do not hardcode model names — always read from `process.env.ANTHROPIC_MODEL`
- Do not increase the HTML truncation limit (currently 15k chars) without load-testing token costs — 5 parallel calls amplify fast
