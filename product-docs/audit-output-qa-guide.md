# Audit Output QA Guide

## Purpose

Use this doc to evaluate whether the improvements shipped across connected data enrichment, quality calibration, and agent prompt rewrites are actually performing in live audits — not just structurally present in the code. Run 3–5 audits against connected accounts (where GA4 + GSC data is available) and evaluate each section below.

The goal is to catch prompt gaps that only show up against real data, identify where agents are still defaulting to checklist behavior despite the diagnostic framing, and confirm the executive summary is synthesizing at the level it should.

---

## Before You Start

For meaningful evaluation, run audits against:

- At least one **connected account** (GA4 + GSC active) so you can evaluate whether real data is being used
- At least one **standard account** (HTML only) so you can compare reasoning quality without data
- Ideally one site you know well enough to judge whether the findings are accurate

Note the composite score and each agent score before expanding anything. Then evaluate the output sections below.

---

## 1. Executive Summary Card

This is the first thing visible above the agent cards. It should feel like a senior practitioner's opening statement, not a summary of summaries.

**Signs it's working:**
- The `overall_verdict` names a specific thesis about the site's marketing health — not "this site has strengths and weaknesses" but something like "strong organic presence undermined by a conversion path that hasn't been designed for the traffic it's receiving"
- `top_priorities` are ranked by business impact, not by agent order. If priority 1 is always from the content agent or always from technical, that's a signal it's echoing agent order rather than synthesizing
- At least one priority is cross-cutting — it references a pattern across two agents rather than just repeating each agent's #1 finding
- `biggest_strength` is specific. "Strong headline" is not specific. "Specific, quantified social proof in the hero section that directly addresses the primary buyer objection" is specific
- `quick_wins` are things that could actually be done this week — not strategic recommendations repackaged as quick wins

**Signs it's not working:**
- Verdict reads like a boilerplate opener ("This audit reveals several opportunities for improvement across key dimensions")
- Top priorities are listed in agent order (content #1 always first, technical always last)
- Nothing cross-cutting — every priority maps cleanly to exactly one agent
- Quick wins are medium-term strategic moves ("invest in content marketing")
- When connected data is present, the summary doesn't reference any of it — it reads the same as a standard audit

---

## 2. Conversion Agent

This is the agent most changed by both the data enrichment and the prompt rewrite. It's also the easiest to evaluate because the before/after is stark.

**On a connected audit, signs it's working:**
- CVR by channel is referenced specifically ("Organic Search converting at 0.8% vs. Direct at 3.2% suggests the organic audience intent isn't matching the page's conversion ask")
- If top events are auto-collected only, the finding explicitly calls out that no custom conversion tracking is in place — not just "tracking setup is basic"
- Device split appears in a finding when mobile sessions are dominant but engagement metrics are weak
- Landing page bounce rates by page are used when there's variation — the agent doesn't just report average bounce rate

**Behavior Model classification:**
- The `funnel_leaks` findings should distinguish between motivation failures, ability failures, and prompt failures — not just list friction points generically
- "Step 0 finding": the conversion agent should identify what the page is asking the visitor to do and the single most likely reason they won't do it, early in the findings. If `critical_fixes[0]` or the first funnel_leak reads like a high-level diagnosis rather than an element-level fix, that's the right behavior.

**Signs it's still in checklist mode:**
- Findings don't reference GA4 data at all on a connected audit
- Social proof scored without distinguishing between specific/credible and generic ("great service!")
- All funnel leaks are framed as friction (ability failures) — no motivation or prompt failure findings
- `ab_tests` are generic hypotheses not tied to specific observed evidence

---

## 3. Content Agent

**Signs it's working:**
- The five-second hierarchy is reflected in finding weight — headline and value prop findings are more prominent than body copy findings
- Substitution test result appears somewhere: either "this positioning could appear on any competitor's homepage" (flag) or a specific claim that only this company could make (positive)
- Customer language vs. company language is called out when the gap is present — specific examples, not just "use customer-centric language"
- The `before_after` examples are genuinely rewritten in customer language, not just shorter or snappier versions of the same company language

**Signs it's still in checklist mode:**
- Headline and body copy findings are weighted equally
- Value proposition critique is generic ("could be more specific") without naming what's generic about it
- `before_after` examples don't change the fundamental frame of the copy — they just polish it
- Wins and critical fixes are balanced 3/3 even when the site is clearly weak or clearly strong

---

## 4. SEO Agent

This agent has the most verifiable outputs because PageSpeed scores and HTML signals are directly observable.

**Step 0 — crawlability check:**
- The first or most prominent technical finding should address whether Google can find, crawl, and index the page
- If there's a noindex tag, canonical pointing elsewhere, or robots block — this must appear as Critical, not buried
- If the foundation is clean, the finding should acknowledge it briefly and move on, not skip it entirely

**PageSpeed interpretation:**
- Findings should name root cause categories, not just scores. "LCP of 4.2s — likely caused by an unoptimized hero image or render-blocking resource in the document head" vs. "LCP is poor at 4.2s"
- The `pagespeed` object in the output should match the actual Lighthouse scores from the run — if these are being fabricated by the model rather than passed from real data, scores will be rounded to suspiciously clean numbers (70, 75, 80)

**Discoverability intent:**
- If title, H1, schema, and tracking are all weak, the finding should say something like "no systematic discoverability investment" — not just list four separate missing items
- Tracking status should distinguish between GA4 present (good), GTM present but GA4 unclear (note), and nothing (flag analytics hygiene explicitly)

**Signs it's still in checklist mode:**
- PageSpeed findings report numbers without root cause hypotheses
- Four separate findings for title/H1/schema/tracking with no synthesis
- Crawlability not addressed until dimension 3 or 4

---

## 5. Competitive Agent

This is one of the harder agents to evaluate without knowing the market, but the framing is observable.

**Signs it's working:**
- The differentiation test result is explicit: does the positioning survive the substitution test or not? The finding should name whether the core claims are generic or structurally differentiated
- Objection map: at least one finding identifies something conspicuously absent — an objection the comparison-stage buyer would bring that the page ignores
- `likely_competitors` are plausible given the page content — not generic industry names that could apply to any business in the category
- When GSC query data is available, comparison/alternative search terms are referenced if present or noted as absent

**Signs it's still in checklist mode:**
- Positioning Clarity scored without applying the substitution test
- `likely_competitors` are clearly generic placeholders
- No finding addresses what the page doesn't say — only what it does

---

## 6. Strategy Agent

The strategy agent is uniquely evaluable on one output: `biggest_lever`. This is the primary deliverable.

**Signs it's working:**
- `biggest_lever` is a strategic observation, not an execution fix. "Redesign the CTA button" is not a lever. "The site is built for a consultative sales model but has no credibility infrastructure — no team visibility, no case studies, no thought leadership — which means every qualified visitor arrives at a trust deficit the page can't resolve" is a lever.
- Business model inference appears somewhere in the findings — the agent should demonstrate it understands what kind of business this is before making strategy recommendations
- Channel coherence is assessed, not just channel presence. "Has SEO and paid but no content feeding organic, so the two channels aren't compounding" vs. "uses multiple channels"
- When GA4 data is present, session mix is used as evidence, not just the inferred channel presence from HTML

**Signs it's still in checklist mode:**
- `biggest_lever` is a tactical change
- Acquisition channel score based on how many channels appear to be active, not whether they're coherent
- No retention signal assessment at all

---

## 7. Scoring Sanity Check

After reviewing findings, look back at the dimension scores and composite.

**What to check:**
- Dimension scores should feel calibrated to the benchmark language in the prompts. A 7 should mean "above average for a site of this type" — not just "present and functional." If most dimensions are clustering at 6–8 regardless of site quality, score inflation is still happening at the dimension level even though the composite is now computed correctly.
- The composite score should reflect the finding severity. A site with multiple Critical funnel leaks and a noindex tag should not score 68/100.
- Compare score labels to your own assessment: does "Average" at 64 feel accurate for this site, or does it feel generous? If it consistently feels generous, the benchmark language in the rubrics needs another calibration pass.

---

## Reporting Gaps Back

When you find a gap — an agent still in checklist mode, a summary that isn't synthesizing, a finding that ignores available data — note:

1. Which agent and which finding/field
2. What data was available that wasn't used (or what framing was expected but absent)
3. Whether it's a data routing issue (the context string isn't reaching the agent) or a reasoning issue (the data is there but the agent isn't using it)

Data routing issues get fixed in `app/api/audit/route.ts` and `lib/gsc-ga4.ts`. Reasoning issues get fixed in the agent's system prompt in `lib/agents.ts`, usually by making the directive more specific or adding an explicit "when X data is present, do Y" instruction.
