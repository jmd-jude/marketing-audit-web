# Marketing Intelligence

## Vision
Give a traditional direct mail agency the ability to deliver boardroom-quality digital marketing analysis — without hiring a digital team.

## Problem
Boutique agencies that built their business on direct mail and catalog work are being asked by clients to weigh in on their digital presence. They don't have the staff, tooling, or budget to do it properly. The gap between "we don't do that" and "we hired a specialist firm" has been expensive and embarrassing.

## Target User
An agency strategist or account lead who needs to walk into a client meeting and speak credibly about that client's website marketing effectiveness — without spending three days pulling data manually.

*(Secondary: the agency's clients themselves, if the tool is eventually white-labeled and handed to them for self-service.)*

## Value Proposition
Enter any URL. Get a structured five-dimension marketing audit — scored, prioritized, and actionable — in under 60 seconds. No analyst, no briefing doc, no waiting.

The output isn't a report card. It's a pitch artifact: a conversation starter the agency can use to expand scope, justify recommendations, and demonstrate expertise that didn't exist before.

## Delivery Model (Current)
Concierge-first. The operator runs the audit, reviews the full results, then shares a persistent link (`/audit/[id]`) with the prospect or client. The recipient sees a teaser — composite score, overall assessment, biggest strength, top priority finding. Full report (remaining priorities with action steps, quick wins, all five agent analyses) unlocks with a separate code the operator controls.

Two code pools:
- **Invite codes** (`INVITE_CODES`) — gate running an audit. Handed out to control who can use the tool.
- **Unlock codes** (`NEXT_PUBLIC_UNLOCK_CODES`) — gate the full report reveal. Held back until there's a reason to share — a conversation, a meeting, a payment.

This model keeps the operator in every deal during the concierge phase. Self-serve (Stripe paywall, per-audit pricing) is a later motion once the tool earns its value proposition in the market.

## Positioning
This is not a general-purpose SEO tool (it's not replacing Ahrefs or Semrush). It's not a website grader (it's not Hubspot's free tool). It sits between "nothing" and "full digital audit engagement" — purpose-built for agencies that want to add a digital analysis layer to existing relationship-based work.

The tier model (Standard → Connected → Agency) is intentional: the tool is designed to grow from a no-auth demo into a full connected-data platform as the agency's practice matures.
