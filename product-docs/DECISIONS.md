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

**Decision:** Data provenance shown as credibility signal, not tier upsell  
**Why:** The `DataSourcesPanel` component (tier upsell framing) has been deprioritized. Instead, a lightweight "What We Analyzed" tag cluster in the report shows what data sources powered the audit — PageSpeed, interior pages, GSC/GA4, competitive data. This builds credibility without implying a SaaS product pricing ladder that doesn't exist yet.  
**Tradeoff:** Loses the explicit upsell surface. Can be revisited when self-serve tiers become real.

---

**Decision:** "Wizard of Oz" product design — hides AI infrastructure from end users  
**Why:** The primary audience (agency staff, their clients) should interact with a polished analysis tool, not a "Claude-powered" developer prototype. The underlying model is abstracted entirely.  
**Tradeoff:** Makes it harder to set expectations about what the tool can and can't do (hallucinations, inference limitations). Model attribution is visible only in the run stats bar for power users.

---

**Decision:** Service account authentication instead of user-facing OAuth  
**Why:** OAuth puts friction on the operator — they'd need to connect their Google account and manage session cookies. The service account model moves setup to the client side (one-time Viewer grant) and makes data always-on with no session management. Simpler to operate, no token refresh to worry about, and fits the concierge model where the agency handles setup on behalf of the client.  
**Tradeoff:** Requires a manual client onboarding step that the agency has to walk through with each client. Doesn't scale to self-serve — every new client domain needs a human to add the service account. Also locks the tool to a single GCP service account identity, which could become a permission management headache at scale.

---

**Decision:** Dual Discord events (start ping + completion embed)  
**Why:** The start ping gives visibility into audit initiation in real time — useful for catching abandoned audits or long-running ones that might have stalled. The completion embed has the full data payload. Together they let someone watching Discord diagnose whether a problem was at fetch time or agent time.  
**Tradeoff:** Two pings per audit adds noise at higher volume. The start ping contains minimal data (no scores) so it's only useful for operational monitoring.

---

**Decision:** Server-side audit log (human-readable + JSONL)  
**Why:** The Discord embed is ephemeral — no way to query historical audits, look for patterns, or review what agents actually output. The log files give a persistent record of every audit: full agent outputs, user messages, GSC/GA4 context, token usage. The JSONL format is specifically designed for future data analysis (scoring calibration, prompt tuning).  
**Tradeoff:** Logs live on the server filesystem, which means they're lost on Vercel cold starts / redeployments. Fine for local dev and a dedicated server — needs rethinking for high-volume Vercel deployment.

---

**Decision:** Discord webhook for monitoring, not a dashboard  
**Why:** Low overhead. The agency doesn't need a metrics dashboard right now — Discord gives visibility into usage, token costs, and scores without building instrumentation.  
**Tradeoff:** Not scalable if usage grows significantly. No historical log or aggregation.

---

**Decision:** Full report gate is email capture + manual operator delivery, not a code or instant unlock  
**Why:** Instant unlock removes the operator from the loop and feels like a self-serve product that doesn't yet exist. Code-based unlock requires sending two things. Email capture fires a Discord ping with the prospect's email and the pre-built `?full=1` URL — operator sends it when ready. The async gap is intentional: it supports the perception that a human reviewed the output, which is worth preserving during validation.  
**Tradeoff:** Dependent on operator responsiveness. Doesn't scale without automation (email infra, Stripe) but that's fine for the concierge phase.

---

**Decision:** Composite score is a weighted average (not a model-assigned holistic score)  
**Why:** Predictable, auditable, and tuneable. Weights are defined in `lib/agents.ts` and can be adjusted without touching prompts.  
**Tradeoff:** The score doesn't capture cross-agent interactions or holistic judgment. Two sites with the same weighted average may have very different profiles.
