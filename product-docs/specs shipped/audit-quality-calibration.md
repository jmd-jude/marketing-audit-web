# Audit Quality Calibration

> **STATUS: SHIPPED.** All items in this doc are implemented — bounce rate fix, dimension-computed scores, score label thresholds, benchmark language, executive summary call, and agent prompt rewrites. This doc is retained as an implementation record. For QA guidance on evaluating the live output, see `audit-output-qa-guide.md`.

## Background

This doc covers three related quality problems: a metric calculation bug, a scoring consistency issue, and two presentation gaps that separate the current output from what a professional $500–$5000 audit would deliver. The connected data enrichment work (`connected-data-enrichment.md`) is a prerequisite — several of these improvements depend on having real performance data, not just structural HTML observations.

The agent prompts in `lib/agents.ts` are actually solid for a fast build. The scoring rubrics are concrete, the output schema is rich, and features like before/after copy examples and A/B test hypotheses are genuine differentiators. These are calibration problems on a good foundation.

---

## 1. Bounce Rate Calculation Bug

**File:** `lib/gsc-ga4.ts`, `fetchGa4Data()`, lines ~195–210

**Problem:** Bounce rate and engagement rate are computed as an unweighted average of the new-visitor row and the returning-visitor row. This is mathematically wrong.

Current code:
```ts
totalBounce += bounce
count++
// ...
bounceRate = totalBounce / count
```

If a site has 900 new visitors at 70% bounce and 100 returning at 30% bounce, this returns 50% (average of 70 and 30). The correct answer is 66% (session-weighted). For a site whose traffic is predominantly new visitors with high bounce, this underreports a significant problem.

**Fix:** Weight by session count.

```ts
totalBounce += bounce * sessions
totalEngagement += eng * sessions
totalSessions += sessions
// ...
if (totalSessions > 0) {
  bounceRate = Math.round((totalBounce / totalSessions) * 1000) / 10
  engagementRate = Math.round((totalEngagement / totalSessions) * 1000) / 10
}
```

Apply the same weighted approach to `engagementRate`. The `newVsReturning` session counts are already correct — only the rate calculations are affected.

---

## 2. Score Computation: Compute from Dimensions, Don't Trust the LLM

**File:** `lib/agents.ts` (all five agents), `app/api/audit/route.ts` (score extraction)

**Problem:** Each agent outputs a `"score": <0-100>` field that the LLM generates independently of the five dimension scores it also produces. There is nothing enforcing consistency between them. An agent that scores 6, 5, 4, 7, 6 across its dimensions might return a top-level score of 68 because the LLM judges holistically and tends toward generosity. This produces score inflation and inconsistency between agents.

**Fix:** Remove the `"score"` field from agent output schemas and compute it in application code as the mean of dimension scores times 10. The LLM should not be trusted to produce a calibrated numeric summary.

In `app/api/audit/route.ts`, wherever the agent score is extracted from the response JSON, replace it:

```ts
// Instead of: const score = parsed.score
const dims = parsed.dimensions as Array<{ score: number }>
const score = dims?.length
  ? Math.round(dims.reduce((sum, d) => sum + d.score, 0) / dims.length * 10)
  : parsed.score ?? 0
```

Also remove `"score": <number 0-100>` from the output format instructions in each agent's system prompt — it adds noise and the LLM will try to fill it with something that may not match.

One exception: the `strategy` agent outputs `brand_score` and `growth_score` as separate sub-scores alongside `score`. These can stay as LLM-generated if they're used for display only, not for composite score calculation. Confirm which fields actually feed the weighted composite before removing.

---

## 3. Executive Summary: Cross-Cutting Prioritization

**Problem:** Five agent cards with their own findings is the raw material of an audit, not the deliverable. A professional audit opens with a synthesis: "here are the 3–5 highest-priority issues, full stop." There is currently no surface that looks across all five agents and ranks findings by impact. The strategy agent has a `biggest_lever` field, but it is scoped to brand/growth only.

**Fix:** Add a sixth lightweight LLM call that receives all five agent output objects and produces a structured executive summary. This call fires after all five agents complete — it is not part of the parallel batch.

Suggested output schema:

```json
{
  "overall_verdict": "<2-3 sentence plain-language summary of the site's marketing health>",
  "top_priorities": [
    {
      "rank": 1,
      "area": "<agent label or cross-cutting>",
      "finding": "<specific issue>",
      "why_it_matters": "<business impact, one sentence>",
      "action": "<specific next step>"
    }
  ],
  "biggest_strength": "<one specific thing the site does well>",
  "quick_wins": ["<change that can be made this week>", "<change>", "<change>"]
}
```

`top_priorities` should be capped at 5 items. The prompt should instruct the model to rank by estimated business impact, not by agent order, and to surface cross-cutting issues (e.g. "no conversion tracking across both analytics and CRO dimensions") rather than just repeating each agent's #1 finding.

**Display:** Render this as a summary card at the top of the results section, above the five agent cards. It should be visible without expanding anything — the first thing a client sees after the composite score.

**Token cost consideration:** This is a small call — input is 5 JSON objects (already computed), output is maybe 300 tokens. At current model pricing it adds less than $0.01 per audit. Worth tracking in the Discord completion embed alongside existing token stats.

---

## 4. Benchmark Context in Scoring

**Problem:** A score of 62/100 means nothing to a client in isolation. Professional audits contextualize scores — "the average site in your category scores around X; you're at Y." The agents currently anchor scoring rubrics to descriptive labels (e.g. "9-10 = crystal clear + compelling") but provide no external benchmark reference.

**Two-part fix:**

**Part A — Score label threshold adjustment.** The current thresholds in `page.tsx` and `scoreLabel()` are generous:

```ts
if (score >= 80) return 'Strong'
if (score >= 65) return 'Good'   // too low
if (score >= 50) return 'Fair'
if (score >= 35) return 'Weak'
return 'Critical'
```

Suggested revision based on professional audit conventions:

```ts
if (score >= 80) return 'Strong'
if (score >= 65) return 'Average'   // was 'Good'
if (score >= 50) return 'Below Average'  // was 'Fair'
if (score >= 35) return 'Weak'
return 'Critical'
```

"Good" at 65 is the label a client will screenshot. At 65, a professional auditor would say "needs work." This matters for credibility.

**Part B — Benchmark language in agent prompts.** Add a brief benchmark context line to each agent's scoring rubric. These don't need to be data-driven — published industry averages for common metrics are widely available and stable enough to hardcode. Examples:

- Content agent: "Most small business sites score 4–6 on Copy Persuasion; scores above 7 are uncommon and represent genuine competitive advantage."
- Technical agent: "Average PageSpeed Performance score for marketing sites is approximately 55–65 on mobile. Scores above 80 on mobile are top quartile."
- Conversion agent: "Typical B2B conversion rates range from 1–3%; e-commerce 1–4%. When GA4 conversion data is available, reference it directly rather than estimating."

The last point in the conversion agent note reinforces that this benchmark guidance should yield to real data when the connected tier is active.

---

## Implementation Order

1. **Bounce rate bug** — standalone fix, no dependencies, ship first.
2. **Score computation** — requires confirming which fields feed the weighted composite in `app/api/audit/route.ts` before modifying agent prompts. Low risk but verify first.
3. **Connected data enrichment** — see `connected-data-enrichment.md`. Prerequisite for the conversion agent's benchmark context to be meaningful, and for the executive summary to have real performance data to synthesize.
4. **Benchmark language in prompts** — prompt edits in `lib/agents.ts`, low effort, can ship alongside or after enrichment.
5. **Executive summary call** — new agent call + new UI card. Depends on enrichment being done so the summary has real data. Highest presentation impact item.

---

## Files to Modify

| File | Change |
|---|---|
| `lib/gsc-ga4.ts` | Fix session-weighted bounce/engagement rate calculation |
| `lib/agents.ts` | Remove `score` field from output schemas; add benchmark language to rubrics |
| `app/api/audit/route.ts` | Compute agent score from dimension average; add sixth summary agent call |
| `app/page.tsx` | Adjust `scoreLabel()` thresholds; add executive summary card to results UI |
