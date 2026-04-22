# Business Context Intake
**Status:** Ready for implementation  
**Scope:** UI form fields + context injection into agent pipeline  
**Effort estimate:** 2–3 hours

---

## Problem

Business model context currently reaches the pipeline only as an emergent property — the strategy agent infers it from page content, and the summary agent reads that inference. If the inference is wrong or thin, every downstream priority ranking is miscalibrated. There's no mechanism for the person running the audit to supply context the page doesn't make obvious.

---

## What to Build

Add two required fields and one optional field to the audit kickoff form in `app/page.tsx`, alongside the existing name and URL inputs.

### New Fields

**Business Type** (required, dropdown)  
Options:
- Consultative / Professional Services
- E-commerce / Retail
- SaaS / Subscription
- Local Service
- Other

**Primary Conversion Goal** (required, short freetext, max 80 chars)  
Placeholder: "e.g. book a discovery call, start a free trial, purchase a product"

**One-line description of target customer** (optional, freetext, max 120 chars)  
Placeholder: "e.g. marketing directors at mid-size B2B companies"

---

## How Context Gets Into the Pipeline

### 1. Pass fields through the audit request

Add `businessType`, `conversionGoal`, and `targetCustomer` as query params on the `GET /api/audit` call, alongside the existing `name`, `company`, and `url` params.

### 2. Format a context block in the route

In `app/api/audit/route.ts`, construct a `businessContext` string from the params:

```
## Business Context (operator-supplied)
- Business type: {businessType}
- Primary conversion goal: {conversionGoal}
{- Target customer: {targetCustomer}  ← only if provided}
```

### 3. Inject into every agent

Prepend `businessContext` to the `additionalContext` string for all five agents — before PageSpeed, GSC, GA4, or interior page content. It should be the first thing every agent reads after the URL.

### 4. Inject into the summary prompt's user message

Prepend the same `businessContext` block to the summary agent's user message (in `runSummaryAgent`), before the five-agent JSON blob. The summary agent already has Step 0 business model logic (added in the B+ to A- upgrade) — this gives it ground truth instead of inference.

---

## Validation

- `businessType` and `conversionGoal` required before form submits
- `conversionGoal` max 80 chars, `targetCustomer` max 120 chars
- If params are missing server-side (direct API calls), agents run without the block — graceful degradation, no error

---

## How to Verify (Jude will do this manually)

Run two audits against the same URL — once as "Consultative / Professional Services, book a discovery call" and once as "E-commerce / Retail, purchase a product." The summary agent's `top_priorities` ranking should differ meaningfully between the two runs, reflecting the priority filter logic in the summary prompt.

---

## Out of Scope

- Surfacing business context fields on the `/audit/[id]` report page

---

## Neon Persistence

Add `businessType`, `conversionGoal`, and `targetCustomer` to the `writeAuditLog` payload type in `route.ts` and pass the values through. They should persist to Neon as part of the audit record so they're available when we surface them in the report UI later. UI display on the report page is out of scope for this sprint.
