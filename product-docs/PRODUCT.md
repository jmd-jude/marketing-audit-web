# Marketing Intelligence

## Vision
Give any site owner or operator boardroom-quality digital marketing analysis — without hiring a team. Enter a URL, get a structured five-dimension audit in under 60 seconds.

## Problem
There's a wide gap between "nothing" and "hire a digital agency." Most businesses operate in that gap — they know their site probably has problems, but they don't have the staff, budget, or time to diagnose them properly. This tool closes that gap.

## Target User (evolving)
Anyone responsible for a website's marketing performance who can't justify a full-service engagement. That includes agency strategists running audits on client sites, small business owners, and founders evaluating their own digital presence.

The original framing was direct mail agencies specifically. That's still a real wedge, but the product isn't constrained to it.

## Value Proposition
Enter any URL. Get a structured five-dimension marketing audit — scored, prioritized, and actionable — in under 60 seconds. The output is a shareable report that reads like it was produced by a specialist, not a developer tool.

## Delivery Model (current)
Concierge-first. The operator runs the audit, reviews the full results, then shares a persistent link (`/audit/[id]`) with the prospect.

The report has two zones:
- **Free zone** — always visible. Composite score, agent sub-scores, overall assessment, data provenance, and all five top findings (what was found + why it matters, no action steps).
- **Full report** — unlocked via `?full=1` URL param. Includes action steps, quick wins, copy rewrites, funnel analysis, and all five agent deep-dives in a tabbed layout.

Gate flow: prospect sees the free zone, enters their email to request the full report. That fires a Discord notification to the operator with the email and the pre-built `?full=1` URL ready to send. Operator sends it on their timeline. The async delivery is intentional — it preserves the sense that a human reviewed and curated the output.

A `/sample` page shows a full unlocked report (operator-chosen audit ID via `SAMPLE_AUDIT_ID` env var). Linked from the gate card so free-zone viewers can see what they're requesting before they commit.

`INVITE_CODES` gates running an audit — controls who can generate new reports and manages API cost exposure.

Self-serve (Stripe paywall, per-audit pricing) is a later motion once the value proposition has been validated in the market.

## Positioning
Not a general-purpose SEO tool (not replacing Ahrefs or Semrush). Not a website grader (not Hubspot's free tool). A structured marketing intelligence report — five dimensions, scored and ranked, with specific recommendations — that can be produced for any site in under a minute.
