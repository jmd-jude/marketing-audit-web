# Business Context Questionnaire — Functional Spec

## What This Solves

The 5-agent audit currently has no knowledge of what this business considers a conversion, who their buyer is, or what their primary marketing challenge is. Agents infer from homepage HTML alone. That inference is often directionally right but breaks down with a skeptical client who spots a finding built on a wrong assumption — "they said our goal is to generate leads, but we're a self-serve product."

This feature adds a pre-audit context step: a lightweight homepage scan that generates 3–4 specific, pre-filled questions the user confirms or corrects before the audit runs. Their answers get injected into all 5 agents as structured context, replacing inference with knowledge for the highest-leverage inputs.

The quality improvement is most pronounced for the conversion and strategy agents, which currently make the most context-dependent inferences. Content and competitive agents benefit too — knowing the target buyer changes how ambiguous findings get framed.

**Sequencing note:** This spec is designed for the current single-page audit. When multi-page crawl ships, the pre-scan agent should receive interior page content as well — knowing what's on /pricing and /about improves question grounding considerably. That's a one-line change to the pre-scan prompt when the time comes.

---

## New Endpoint: `/api/prescan`

### Purpose

Fetch the homepage, run a lightweight LLM inference pass, and return 3–4 pre-filled questions specific to what the AI actually observed on this site.

### Runtime

Edge. No Node-only dependencies — no googleapis, no file I/O.

### Request

`GET /api/prescan?url=<encoded-url>`

Returns JSON (not SSE — single-shot response, no streaming needed).

### Pre-scan LLM call

**Model:** `process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'`

Haiku would be faster and cheaper here (~$0.001 vs ~$0.01), but since the model is env-configurable, keep the pattern consistent. The pre-scan payload is small (~3k chars of HTML) so Sonnet completes in 2–4 seconds — acceptable.

**HTML truncation:** 5,000 chars (vs 15k for the main audit). The pre-scan only needs enough to understand business type and intent — not a full content analysis. Lower token cost, faster response.

**System prompt:**

```
You are a marketing analyst doing a quick pre-read of a homepage before a deeper audit. Your job is to identify 3–4 key pieces of context that will sharpen the audit findings — specifically the things you'd have to guess at based on the page alone.

For each question, infer the most likely answer from what you observe on the page. The user will confirm or correct your inference — so accuracy of the inference matters. A confident wrong guess is worse than a hedged one.

Focus on:
1. Business type/model (B2B SaaS, local service, e-commerce, agency, etc.)
2. Primary conversion goal (the main action the site is trying to drive)
3. Target buyer persona (who the primary customer is)
4. The question that most affects audit quality given this specific site — pick the ambiguity that, if wrong, would most distort the findings

Do NOT ask generic questions. Every question must be grounded in something specific you observed on this page.

Return ONLY a JSON object. No prose, no markdown, no code blocks.

Output format:
{
  "questions": [
    {
      "id": "business_type",
      "question": "<specific question about this site>",
      "inferredAnswer": "<your best inference from the page>",
      "confidence": "high" | "medium" | "low",
      "reasoning": "<one phrase: what on the page led to this inference>"
    }
  ]
}

Rules:
- Exactly 3–4 questions. No more.
- id values must be one of: business_type, conversion_goal, target_buyer, challenge
- confidence: "high" = you're certain from clear signals, "medium" = reasonable inference, "low" = you're guessing
- inferredAnswer must be a concise phrase (under 15 words), not a sentence
- reasoning must be brief — the specific signal (e.g., "pricing page visible in nav", "hero CTA says 'Book a Demo'")
- Do not ask about things clearly stated on the page — only ask about genuine ambiguities
```

### Response shape

```ts
interface PrescanQuestion {
  id: 'business_type' | 'conversion_goal' | 'target_buyer' | 'challenge'
  question: string
  inferredAnswer: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

interface PrescanResponse {
  questions: PrescanQuestion[]
  error?: string  // if fetch or LLM failed — UI falls back gracefully
}
```

### Error handling

If the homepage fetch fails or the LLM call fails, return `{ questions: [], error: "..." }`. The UI falls back to the static form (4 generic questions, no pre-fill). The audit is not blocked by a pre-scan failure.

If JSON parse fails, same fallback.

---

## Static Fallback Form

Used when: pre-scan fails, or user is on a slow connection and the pre-scan hasn't resolved before a timeout (treat 8 seconds as the ceiling — if prescan hasn't returned, show fallback).

Four fixed questions:

| id | Question | Placeholder |
|---|---|---|
| `business_type` | What type of business is this? | e.g. B2B SaaS, local service, e-commerce... |
| `conversion_goal` | What's the primary action you want visitors to take? | e.g. book a demo, make a purchase, call us... |
| `target_buyer` | Who is your primary customer? | e.g. marketing directors at mid-market companies... |
| `challenge` | What's your biggest marketing challenge right now? | e.g. generating qualified leads, improving conversion... |

No pre-fill — all fields empty. This is the worse experience, but it's correct behavior under failure.

---

## Context Injection

### Format

The business context block is assembled from the user's answers and prepended to `additionalContext` for all 5 agents. Format:

```
## Business Context (provided by client)

Business Type: [answer]
Primary Conversion Goal: [answer]
Target Buyer: [answer]
Main Marketing Challenge: [answer]
```

Omit any field the user left blank.

### Routing

Inject into all 5 agents. Do not do per-agent selective injection — business context is short (~200–400 chars, ~50–100 input tokens per agent), and the cost of omitting relevant context from an agent that could use it outweighs the marginal token savings. Content, conversion, competitive, strategy, and technical agents all benefit from knowing the business type and conversion goal, even if some dimensions weight it less heavily.

The business context block prepends to the existing `additionalContext` assembly in the audit route. Current assembly logic (PageSpeed → crawl data → GSC → GA4) is unchanged — business context just goes first.

```ts
// In the agent additionalContext assembly loop:
const parts: (string | null)[] = []

// Business context first — all agents
if (businessContext) parts.push(businessContext)

// Existing per-agent routing unchanged
if (key === 'technical') { ... }
if (gscContext && GSC_AGENTS.has(key)) parts.push(gscContext)
if (ga4Context && GA4_AGENTS.has(key)) parts.push(ga4Context)
```

### Passing context to the audit route

The audit route currently accepts query params via GET. Business context answers get passed as a single URL-encoded JSON string:

`GET /api/audit?url=...&name=...&company=...&businessContext=<encoded-JSON>`

`businessContext` is a JSON object: `{ business_type, conversion_goal, target_buyer, challenge }`. Each value is a user-provided string (may be blank). The audit route decodes it and assembles the preamble block before launching agents.

The format string assembler:

```ts
function formatBusinessContext(ctx: Record<string, string>): string | undefined {
  const lines: string[] = []
  if (ctx.business_type)    lines.push(`Business Type: ${ctx.business_type}`)
  if (ctx.conversion_goal)  lines.push(`Primary Conversion Goal: ${ctx.conversion_goal}`)
  if (ctx.target_buyer)     lines.push(`Target Buyer: ${ctx.target_buyer}`)
  if (ctx.challenge)        lines.push(`Main Marketing Challenge: ${ctx.challenge}`)
  if (lines.length === 0) return undefined
  return `## Business Context (provided by client)\n\n${lines.join('\n')}`
}
```

---

## UI Flow

### State machine additions to `page.tsx`

Current states: `idle` → `running` → `done`

New states inserted between idle and running:

```
idle → prescanning → questions → running → done
               ↓ (error/timeout)
           questions (fallback form, no pre-fill)
```

`prescanning`: URL/name/company have been submitted. "Analyzing your homepage..." spinner overlays or replaces the form. Duration: 2–5 seconds typical. Timeout: 8 seconds, then fallback.

`questions`: Questions form rendered. User confirms/edits answers and clicks Run Audit.

### Questions step UI

**Header:** "A few quick questions before we run your audit"  
**Subheader:** "Based on your homepage, we've pre-filled what we could. Confirm or adjust — this helps us give you findings specific to your business, not generic advice."

Each question renders as a card:
- Question label (the `question` string from the pre-scan response)
- Pre-filled input field with `inferredAnswer` as the value
- Subtle reasoning hint below the field: "Based on: [reasoning]" — shown in muted text when confidence is `medium` or `low`, hidden when `high`
- Confidence `low` fields: show a note "We weren't sure about this one" and use placeholder text instead of pre-filling the value

**Primary CTA:** "Run Audit" — launches audit with answers

**Secondary action:** "Skip this step" — small link, launches audit without business context (current behavior). Positioned below the primary CTA. Not a cancel button — reframed as "I'd rather skip the context."

**Pre-fill UX note:** High-confidence fields are pre-filled and the user is confirming. Low-confidence fields are empty placeholders. This distinction matters — pre-filling a bad guess is worse than leaving it blank, because the user may not notice and correct it.

### What changes in the audit run sequence

When the user hits "Run Audit" from the questions step:
1. Browser assembles answers into `businessContext` JSON
2. Calls `/api/audit` with existing params + `businessContext`
3. UX transitions to `running` state — everything from here is identical to current behavior

When the user hits "Skip this step":
1. Calls `/api/audit` with no `businessContext`
2. UX transitions to `running` state

### SSE event additions

The `fetched` event should include a `hasBusinessContext: boolean` flag so the UI can surface it in the Data Inputs panel.

```ts
send({
  type: 'fetched',
  // ... existing fields ...
  hasBusinessContext: !!businessContext,
})
```

The Data Inputs panel can show "Business context: provided" or "Business context: not provided" as a row. When provided, consider showing a collapsed view of the Q&A pairs — this is a trust signal for the client ("the audit knew your goals before analyzing your site").

---

## Logging

Add `businessContext` to the `writeAuditLog` payload. It's already going into `additionalContext` for each agent (which is logged per-agent in `userMessage`) but having it explicit at the top level makes it queryable:

```ts
businessContext: businessContext ?? null,  // add to writeAuditLog payload type
```

This flows into the Neon Postgres `payload JSONB` column without schema migration. Queryable via `payload->>'businessContext'`.

---

## Token Cost Impact

| | Current | With business context |
|---|---|---|
| Pre-scan LLM call | 0 | ~600 input + ~200 output tokens (~$0.003 at Sonnet) |
| Business context preamble (5 agents) | 0 | ~100 tokens × 5 = ~500 input tokens (~$0.001) |
| Total incremental cost per audit | $0 | ~$0.004 |

Negligible. The pre-scan call is the only meaningful addition.

---

## Latency Impact

**Pre-scan phase (new):**
- Homepage fetch: ~0.5–1.5 seconds
- LLM inference call: ~2–4 seconds (Sonnet on 5k chars of HTML)
- Total: ~3–5 seconds while user watches a spinner

**Audit phase (unchanged):**
- Same pipeline as today — HTML + PageSpeed + robots + connected-data in parallel, then agents
- Business context adds ~0 wall-clock time (just a string prepend before agents launch)

**User perception:**
- "Analyzing your homepage..." spinner for 3–5 seconds
- Questions appear, user spends 20–60 seconds answering
- Run Audit → same 40–60 second wait as today

The pre-scan latency is absorbed by the form-fill step. From the user's perspective, the audit doesn't take longer — there's just a useful intermediate step before it runs.

**Parallelization opportunity (deferred to v2):** During the questions step, the browser could kick off background fetches of PageSpeed and connected-data (both are already accessible as standalone API calls). Storing results in component state and passing them to the audit route (via POST body + streaming) would eliminate the PageSpeed wait from the audit's critical path, cutting post-Run wait from ~45s to ~15–20s. This requires modifying the audit route to accept POST + pre-fetched data. Deferred — the architecture does not block this optimization; it just doesn't implement it.

---

## What Not to Do

- Do not show more than 4 questions. Every additional question reduces completion rate non-linearly.
- Do not ask questions the page clearly answers. The pre-scan system prompt enforces this, but review question output in logs early.
- Do not block the audit on pre-scan failure. If `/api/prescan` errors, fall back to the static form and let the user proceed.
- Do not pre-fill low-confidence inferences. A wrong pre-fill that goes uncorrected is worse than an empty field. Confidence `low` → placeholder text only.
- Do not hardcode model names — read from `process.env.ANTHROPIC_MODEL`.
- Do not add the context step to the `/audit/[id]` shareable report page. That page renders a completed audit from Neon — there's no run to configure.
- Do not inject business context into the summary agent's user message. The summary agent receives the 5 agent outputs directly and synthesizes from those. The context has already influenced those outputs upstream.

---

## Implementation Checklist

**New files:**
- `app/api/prescan/route.ts` — Edge route, returns `PrescanResponse`

**Modified files:**
- `app/api/audit/route.ts` — accept `businessContext` query param, call `formatBusinessContext`, inject into agent `additionalContext` assembly, add `hasBusinessContext` to `fetched` event, add `businessContext` to `writeAuditLog` payload
- `app/page.tsx` — new `prescanning` and `questions` states, prescan fetch on URL submit, questions form component, pass `businessContext` to audit URL
- `components/DataSourcesPanel.tsx` — add business context row to Data Inputs display

**No schema migration required.** Business context flows through the existing `payload JSONB` column in Neon.
