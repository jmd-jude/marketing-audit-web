# Agent Prompt Strategy

## The Core Problem

Current prompts are structured as **grading rubrics**, not **expert analyst mental models**. Every site gets evaluated against the same abstract ideal, producing competent-but-generic output. The goal is prompts that think before they score.

---

## Three Layers That Separate Junior from Senior Analysis

**1. Business Context Recognition**  
Before scoring anything, an agent needs to classify what it's looking at: business model, buying cycle, primary acquisition motion. High-friction checkout is catastrophic for a $29 consumer product; irrelevant for a consulting firm where "checkout" is a sales call.

**2. Calibrated Benchmarks**  
A score of 6 means nothing without context. Senior analysts know what "good" looks like *for this business type*. The gap between observed and category-expected is where insight lives — not the raw score.

**3. Revenue Impact Translation**  
"Your CTA is generic" is a junior finding. "Your primary CTA uses feature language rather than outcome language at the highest-leverage decision point on the page" is a senior finding. Every observation should connect to a funnel consequence.

---

## What the Current Prompts Are Missing

**A pre-pass business classification.** Each agent should infer before scoring:
- Business model type (DTC, SaaS, B2B services, marketplace, local)
- Primary conversion action the site is driving
- Likely customer decision cycle
- 2–3 category-typical failure patterns to check for

**Specificity over coverage.** Filling many output fields produces fill. Senior output is opinionated — fewer findings, higher conviction, clearer priority.

**Comparative framing.** "Your value prop could apply to three of your top competitors" lands harder than "your value prop is generic."

**Confidence calibration.** Agents currently present inferred findings with the same confidence as observed ones. They should distinguish: what they saw in the HTML, what they inferred, and what data would change the analysis if it existed.

---

## The Data Question

Great analyst + no data = frustrated analyst. The prompts should reflect this — not just the UI tier panel. Agents should explicitly:

1. Note what they observed directly
2. Flag what they inferred
3. Surface what data would materially change their analysis

This makes the GA4/GSC upsell a finding, not a sales panel. "Without Search Console data I can't tell you whether you're winning on the keywords that matter — connecting GSC would change this section significantly."

---

## Process for Getting to A+

1. **Benchmark against reality** — Run audits on 5 known sites (strong and weak, different business types). Note where output feels generic, misses the obvious, or is true-but-unactionable. These become test cases.

2. **Write a senior analyst brief per agent** — Before touching prompts, write 2–3 paragraphs on how an expert practitioner in that domain actually thinks. Conversion = Friction Theory, LIFT Model, Fogg Behavior Model. SEO = schema patterns, crawlability signals, CWV thresholds. These briefs frame the rewrite.

3. **Restructure prompts around process, not rubric** — Replace scoring-first with thinking-first: Observe → Classify → Benchmark → Prioritize → Recommend. Scores come out of the thinking.

4. **Add business-type variance** — For each agent, add conditional framing: "If this is a DTC/SaaS/B2B services site, the most important dimension is X, the common failure pattern is Y."

5. **Iterate against test cases** — Run rewritten prompts against the same 5 sites. Compare. Adjust.

---

## Where to Start

**Conversion Optimization** is the right first agent to get to A+. CRO has the most developed practitioner body of knowledge, and the quality gap between a generic rubric and an expert lens is most legible there. Get one agent right, extract the process, then apply it to the other four.

A templated skill for doing this systematically across all five agents is a natural next step after the first agent is proven out.
