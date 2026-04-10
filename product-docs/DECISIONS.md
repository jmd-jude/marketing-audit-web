# Key Product & Design Decisions

---

**Decision:** Five parallel agents, not one comprehensive agent  
**Why:** Faster results, more structured output, cleaner UI — each agent card maps to one concern. A single "do everything" agent would be slower, harder to display progressively, and produce less focused recommendations.  
**Tradeoff:** Higher token cost per audit (5 model calls vs 1). The 5x multiplication amplifies quickly as HTML or context grows.

---

**Decision:** Vercel Edge Runtime for the API route  
**Why:** SSE streaming (`text/event-stream`) requires Edge runtime on Vercel. Node.js serverless functions don't support long-lived streaming connections in the same way.  
**Tradeoff:** Edge runtime has constraints — no server-side state, limited Node APIs. Database calls or stateful session logic would require a different architecture.

---

**Decision:** JSON-only agent output (no markdown formatting)  
**Why:** Agent results are parsed and rendered as structured UI (score rings, bar charts, lists). Markdown wrapping would require additional stripping and is error-prone.  
**Tradeoff:** Agents must be explicitly instructed not to wrap in markdown. The route defensively strips fences anyway.

---

**Decision:** 15k character HTML truncation limit  
**Why:** Token cost control. 5 parallel calls amplify the cost of large contexts. 15k chars is enough to capture the full above-fold content and most homepage structure.  
**Tradeoff:** Very long-form pages (e.g., long-scroll SaaS homepages) may have below-the-fold content omitted from analysis.

---

**Decision:** PageSpeed data fed only to the technical agent  
**Why:** Core Web Vitals and Lighthouse scores are specifically relevant to the SEO & technical dimension. Passing them to all agents would bloat context without adding signal.  
**Tradeoff:** Other agents can't reference real performance data — content and conversion agents don't know if the page loads slowly.

---

**Decision:** Upsell tier model embedded in the product UI  
**Why:** The Data Sources Panel makes the gap between "what we analyzed" and "what we could analyze with richer data" visible in every audit. This is intentional — the agency uses it to scope and justify a Connected or Agency tier engagement.  
**Tradeoff:** The panel shows features that don't work yet. This is acceptable as a roadmap signal but would need to be hardened before self-service client access.

---

**Decision:** "Wizard of Oz" product design — hides AI infrastructure from end users  
**Why:** The primary audience (agency staff, their clients) should interact with a polished analysis tool, not a "Claude-powered" developer prototype. The underlying model is abstracted entirely.  
**Tradeoff:** Makes it harder to set expectations about what the tool can and can't do (hallucinations, inference limitations). Model attribution is visible only in the run stats bar for power users.

---

**Decision:** Discord webhook for monitoring, not a dashboard  
**Why:** Low overhead. The agency doesn't need a metrics dashboard right now — Discord gives visibility into usage, token costs, and scores without building instrumentation.  
**Tradeoff:** Not scalable if usage grows significantly. No historical log or aggregation.

---

**Decision:** Composite score is a weighted average (not a model-assigned holistic score)  
**Why:** Predictable, auditable, and tuneable. Weights are defined in `lib/agents.ts` and can be adjusted without touching prompts.  
**Tradeoff:** The score doesn't capture cross-agent interactions or holistic judgment. Two sites with the same weighted average may have very different profiles.
