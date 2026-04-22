# Agent Upgrade: B+ to A-
**Status:** Ready for scheduling  
**Scope:** Prompt changes + one data-routing change  
**Effort estimate:** 2–3 hours total (no new integrations required)

---

## Background

The current five-agent system is well-architected. Diagnostic frameworks are sound, forced prioritization (biggest_lever per agent) is the right mechanic, and voice control is specific enough to actually change output. Two gaps prevent the system from producing consistently A-grade work:

1. **Retention scoring is passive.** The strategy agent looks for retention signals but doesn't name the structural mismatch when they're absent the way the business model mismatch logic does.
2. **The summary layer doesn't consume business model context.** It ranks priorities by "estimated business impact" without knowing what business model it's synthesizing for — so a 3 on Conversion Friction and a 3 on Schema & Structured Data come out weighted equally, which they aren't.

A third gap (severity calibration) is partially addressable in prompts but gets meaningfully sharper when the conversion agent has actual CVR data to anchor against. That's a data-routing change, not a new integration — the GA4 pipe already exists.

---

## Change 1: Retention Scoring — Active Mismatch Naming

**File:** `lib/agents.ts`  
**Agent:** `strategy`  
**Type:** Prompt change only

### What to change

In the strategy agent's Diagnostic Approach, Step 2 (Retention signal read) currently instructs the agent to "assess whether the site acknowledges that customers have a life after first conversion." That's a passive scan. Change it to active mismatch naming — the same pattern Step 0 uses for business model mismatches.

**Replace the current Step 2 with:**

```
**Step 2: Retention mismatch diagnosis.** After inferring the business model (Step 0), 
derive what retention infrastructure that model structurally requires. Then check whether 
that infrastructure exists on the site. Name the mismatch explicitly when it's present — 
don't just note that retention signals are absent.

Examples of how to state this:
- A subscription business with no email capture and no content subscription path is 
  investing in acquisition while the retention layer leaks. Name it that way.
- A consultative firm with no newsletter, no case study library, and no community signal 
  has no mechanism to stay top-of-mind between engagements. Name it that way.
- A local service with no repeat-customer incentive and no onboarding content has no 
  infrastructure for its second-most-valuable revenue source. Name it that way.

The Retention & Expansion score should reflect whether the retention infrastructure 
matches what the business model requires — not just whether any retention signals exist.
```

### Why this matters

The current prompt produces a score and a finding like "minimal retention signals present." The new prompt produces a finding like "subscription model with no email capture — acquisition spend has no compounding mechanism." Those are different deliverables.

---

## Change 2: Business Model-Aware Summary

**File:** `lib/agents.ts`  
**Prompt:** `SUMMARY_SYSTEM_PROMPT`  
**Type:** Prompt change only

### What to change

The summary prompt currently instructs the synthesizing model to rank priorities by "estimated business impact." That instruction has no context about what business model it's ranking for. Add a pre-synthesis step that explicitly consumes the strategy agent's business model inference and applies a priority filter before ranking.

**Add this as Step 0 in the summary prompt's Diagnostic Approach section** (before the existing 3-step list):

```
**Step 0: Business model context.** Before ranking anything, read the strategy agent's 
output and extract the inferred business model. Then apply the following priority filter 
to your ranking — these are not absolute rules, but they should shift your ordering when 
two findings are otherwise close in impact:

- Consultative / relationship sale: trust, authority, and team visibility outrank CTA 
  optimization and urgency mechanics. A buyer in a consultative process is not going to 
  convert faster because of a button color — they convert because they trust the firm.

- High-volume transaction / e-commerce: conversion friction and tracking gaps outrank 
  brand consistency and authority signals. Every day with untracked CVR is a day of 
  wasted acquisition spend.

- Subscription with retention requirements: email capture and retention infrastructure 
  outrank one-time conversion optimization. The LTV model only works if the retention 
  layer functions.

- Local service: local signals (schema, location copy, Google Business alignment) 
  outrank broad SEO and content authority. Organic search in a 10-mile radius is 
  categorically different from national organic search.

State the inferred business model in one sentence at the top of your internal synthesis 
before producing output. Do not include this sentence in the JSON — it's for internal 
reasoning only.
```

### Why this matters

Without this, the summary layer produces generically ranked findings. With it, the same five agent outputs produce a ranked list calibrated to what actually moves the needle for that business type. A consultative firm stops getting told to fix its urgency mechanics at priority rank 2.

---

## Change 3: CVR Anchoring in Conversion Agent

**Files:** `lib/agents.ts` (prompt)
**Agent:** `conversion`  
**Type:** Prompt change

This does not require new integrations — GA4 data is already being fetched and passed to all five agents. The change is about how the conversion agent is instructed to use CVR data when it exists.

### What to change

In the conversion agent's Diagnostic Approach, the existing GA4 instructions say: "A channel with high sessions but 0% CVR is a priority finding." That's correct but incomplete. Add a severity calibration instruction:

**Add to the GA4 data section in the conversion agent's Diagnostic Approach:**

```
**Severity calibration using CVR data.** When GA4 conversion data is present, anchor 
the severity of friction findings to actual CVR evidence — don't treat findings as 
equal-weight because they score similarly on the 0–10 rubric.

Specifically:
- A friction finding on a channel driving >30% of sessions with <0.5% CVR is Critical, 
  regardless of its rubric score.
- A friction finding on a channel with <5% of sessions is Medium at most, regardless 
  of how bad the friction is — the audience exposure doesn't justify Critical priority.
- When CVR data is absent (only auto-collected events, or no GA4 at all), flag this 
  explicitly in funnel_leaks as a severity-unknown finding — the friction may be 
  Critical or negligible and there's no way to know without measurement.

The biggest_lever field must reference actual CVR data when it exists. "Mobile accounts 
for 68% of sessions with 0.3% CVR against a 2.1% desktop CVR" is an evidenced finding. 
"Mobile UX appears to create friction" is not.
```

---

## Sequencing

| Order | Change | Effort | Dependency |
|---|---|---|---|
| 1 | Strategy agent — active retention mismatch (Change 1) | 20 min | None |
| 2 | Summary prompt — business model-aware ranking (Change 2) | 30 min | None |
| 3 | Conversion agent prompt — CVR anchoring (Change 3) | 20 min | None |

---

## How to Verify

Run an audit against a site where the business model is unambiguous (a consultative agency, a SaaS with a free trial, a local service). Check three things:

1. Strategy agent's `biggest_lever` names a retention mismatch with the same specificity as the business model mismatch language — not just "minimal retention signals."
2. Summary's `top_priorities` rank reflects the business model type — a consultative site shouldn't have urgency mechanics in the top 2.
3. Conversion agent's `funnel_leaks` severity levels reference CVR percentages when GA4 data is present, not just rubric scores.

If all three pass, the changes are working.
