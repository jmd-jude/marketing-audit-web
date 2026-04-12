## Senior Analyst Brief: Conversion Optimization
A senior CRO practitioner doesn't start by auditing elements — they start by reconstructing the visitor's experience from the moment of arrival. The first question is always: what is this page asking someone to do, and what is the single most likely reason they won't do it? Everything else is secondary. Most sites fail not because their button color is wrong or their CTA text is generic, but because the page makes a persuasion ask it hasn't earned yet — it's requesting a commitment before establishing sufficient motivation, credibility, or clarity. The job of the conversion analyst is to find that gap and name it precisely.

The mental model that organizes everything else is BJ Fogg's Behavior Model: conversion happens when Motivation, Ability, and a well-timed Prompt converge. Senior analysts diagnose failure along all three axes, not just the visible surface. Low motivation means the page hasn't made the case for why this matters to this person right now. Low ability means friction — cognitive (too much to figure out), emotional (too much perceived risk), or physical (too many steps, too many fields). A misfired prompt means the CTA appears before the visitor is ready, or disappears when they finally are. Generic rubrics conflate all three. The analysis has to distinguish them because the remedies are completely different: a motivation problem needs better copy or stronger proof, an ability problem needs simplification or trust scaffolding, a prompt problem needs repositioning.

The second organizing frame is the skeptic's read. A senior analyst reads the page as someone who has been burned before by a product or service in this category — not hostile, but not credulous either. They look for claims that are made without being earned: superlatives without proof ("the best," "the fastest," "trusted by thousands"), social proof that is generic rather than specific ("great service!" vs. "we cut our customer acquisition cost by 40%"), value propositions that could appear unchanged on three competitor sites, objections that are conspicuously absent from the page. The question isn't "is there social proof?" — it's "is there social proof specific and credible enough to move a skeptic who has seen this pitch before?" This is a different question, and it produces very different findings. Finally, the analyst always tries to identify the single highest-leverage change — the one thing that, if fixed, would make everything else less important. That's the finding that earns trust with a client.

---

## Senior Analyst Brief: Content & Messaging
A senior content analyst starts at the top of the page and reads exactly the way a first-time visitor does — once, quickly, skeptically — before doing anything else. The reason is that most content audits review everything with equal attention, which is how they miss the most important finding: what impression does this page create in the first five seconds? The hierarchy of what matters is strict: headline → subheadline → hero CTA → supporting proof → body copy. A mediocre headline can't be rescued by excellent body copy, because most visitors never reach it. The analysis has to be weighted accordingly, with the most critical scrutiny at the top and a clear-eyed assessment of how many visitors are likely to read past each level.

The organizing test for every content claim is the "so what" ladder. You take a claim the site makes — "enterprise-grade security," "seamless integration," "industry-leading support" — and you ask "so what?" until you reach something a real person actually cares about. Companies that have done this work sound categorically different from those that haven't: their copy describes outcomes and transformations, not features and attributes. The related test is the substitution test: take the value proposition and replace the company name with a direct competitor. If it still reads true, the positioning hasn't done its job. Senior analysts are looking for the claim that only this company can make — and flagging its absence loudly when it isn't there.

The third lens is message-market fit: does the language on the page match the language the target customer uses to describe their own problem? This is not about readability or tone — it's about whether the page creates the experience of being understood. Customers extend trust most readily when they feel like a company has already been inside their head. The practical test is to look for customer language — the words a real buyer would use in a conversation about their problem — and check whether the page uses it or replaces it with company/product language. "We help e-commerce brands reduce cart abandonment" is company language. "You're losing 70% of the people who add something to their cart before they check out" is customer language. They describe the same reality, but the second one creates recognition. A senior analyst can identify this gap immediately and knows that fixing it is often higher-leverage than any structural or design change.

---

## Senior Analyst Brief: SEO & Discoverability
A senior SEO analyst always starts with the same question before touching anything else: can Google actually find, crawl, and index this page? Crawlability → indexability → rankability → usability is the correct hierarchy, and most audits invert it — they optimize title tags on a page that has a noindex tag or blocks Googlebot in its meta directives. The HTML provides the evidence to answer this directly: canonical tags, robots meta directives, and the logical structure of the page all signal whether the technical foundation is sound before any discussion of keyword relevance begins. If the foundation is broken, everything downstream is academic.

With real PageSpeed data in hand, the analyst's job is interpretation, not observation — the numbers are already there. The skill is knowing what they mean mechanically. An LCP above 4 seconds is almost always caused by one of three things: an unoptimized hero image, a render-blocking resource in the document head, or a slow server response. High CLS is almost always caused by images without explicit dimensions or ad slots that shift content as they load. High TBT points to long JavaScript tasks blocking the main thread. A senior analyst reads these scores and immediately forms a hypothesis about root cause — they're not just reporting the number, they're telling you why the number is what it is and what the fix category is. The difference between a 72 and a 91 Performance score is rarely mysterious once you've seen enough of them, and that specificity is what makes the finding actionable rather than decorative.

The third lens is what the HTML reveals about discoverability intent — how much thought went into making this page findable and understood by search engines. The signals are concrete and directly observable: Is the title tag under 60 characters with the primary keyword near the front, or is it the company name followed by a generic tagline? Is there a single H1 that reinforces the title, or are there three H1s, or none? Is there schema markup, and if so, is it the obvious type for this business (Organization, LocalBusiness, Product, FAQ) or is it absent entirely? Are images carrying descriptive alt text or blank attributes? Tracking setup — GA4, GTM, Meta Pixel — is readable directly from the script tags. A senior analyst treats these not as a checklist but as diagnostic signals: a site with no schema, a weak title, and no tracking isn't just missing three boxes — it's a site where no one has ever thought systematically about discoverability, and that usually means the problems go deeper than the homepage.

---

## Senior Analyst Brief: Competitive Positioning

A senior competitive analyst reads the page through the lens of a buyer who is actively shortlisting options, not one who has already decided. That distinction matters enormously. A visitor in evaluation mode is asking a different set of questions than a visitor who arrived curious — they're asking "why you over the alternatives I've already seen," and they're pattern-matching for the signals that differentiate a real choice from a commodity one. Most sites are built for the curious visitor and utterly fail the comparison-stage buyer. The first diagnostic is simply: does this site know it has competitors?

The primary organizing test is the differentiation audit. Take the company's core positioning claims and ask whether they survive two filters. First, could a direct competitor make the same claim without changing a word? "We deliver results." "We put clients first." "Trusted by businesses of all sizes." These are not positions — they're placeholders. Second, is the claim grounded in something structural about the business — a proprietary process, a data advantage, a delivery model, a specific niche, a measurable outcome — that a competitor couldn't simply copy by updating their homepage? Positioning that passes both filters is real. Positioning that fails either one is undifferentiated, and undifferentiated companies compete on price by default. That's the finding worth naming.

The second lens is the objection map. A senior analyst reads the page looking for what's conspicuously absent. Comparison-stage buyers come with specific objections — concerns about switching cost, about whether the company can handle their scale, about price-to-value, about post-sale support, about whether this is a proven solution or a bet. Sites that address objections directly ("you're wondering if this works for companies under 50 people — here's what that looks like") earn trust. Sites that don't address them invite the buyer to fill in the blanks with skepticism. The analyst catalogs the likely objections for this category and checks which ones the page answers and which ones it ignores. The ignored objections are often where deals are lost.

The third lens is category language ownership. In any mature market, certain phrases, frameworks, and proof points become the vocabulary of evaluation. A senior analyst asks: what does this company own in the conversation about its category, and what has it ceded to competitors by not claiming it? This is observable from the page — does the company introduce a named framework, a proprietary methodology, a category-defining concept that competitors now have to respond to? Or is it using the same generic language as everyone else in the space? Category language ownership is one of the clearest indicators of long-term positioning strength and is almost entirely absent from most SMB and mid-market sites.

When real GSC data is available, query data is the most direct evidence of competitive positioning in practice: which comparison and alternative searches is the site appearing for, and where? A site with strong branded query volume but zero "X vs. Y" or "best X for Y" impressions has a positioning gap between what it says it is and how the market actually evaluates it.

---

## Senior Analyst Brief: Brand & Growth Strategy

A senior growth strategist reads a website the way a CFO reads a P&L — not as a collection of individual line items but as a system with inputs, outputs, and structural dependencies. The first question isn't "is the brand consistent?" or "are there enough acquisition channels?" It's: what does this business model require to be true about customer acquisition, conversion, and retention, and is the marketing infrastructure built for that reality? A SaaS company that needs low CAC and high LTV requires a different infrastructure than a professional services firm that closes on relationship and reputation. Mismatches between business model and marketing architecture are not execution problems — they're strategic ones, and they don't get fixed by optimizing copy.

The primary diagnostic is the growth model audit. From the page, infer the business model: is this a high-volume/low-touch transaction business, a low-volume/high-touch consultative sale, a subscription with ongoing retention requirements, a local service with geographic concentration, or something else? Once the model is clear, evaluate whether the site is built for it. A consultative services firm with no About page, no team visibility, no case studies, and no thought leadership content has a structural mismatch — relationships require credibility infrastructure, and none is being built. A high-volume e-commerce brand with no email capture, no retargeting signals, and no repeat-purchase incentives is investing in acquisition while leaking retention. Name the mismatch when it's present. That's the finding that elevates the analysis from "here are some improvements" to "here's what's structurally limiting your growth."

The second lens is acquisition channel architecture. The question isn't how many channels are active — it's whether the channel mix is appropriate for the business model and sustainable at the company's likely stage. A single-channel business (all organic, all paid, all referral) has concentration risk that is more consequential the earlier the company is. But channel diversification for its own sake is also wrong — spreading thin across five underinvested channels produces worse results than owning one deeply. The analyst's job is to assess coherence: do the channels in use reinforce each other (SEO building authority that makes paid more efficient, content driving organic that feeds email), or are they isolated bets with no compounding logic? When GA4 channel data is available, this goes from inference to measurement — actual session mix tells you what the company has actually built, not just what it claims.

The third lens is the retention signal read. Most marketing audits focus entirely on acquisition and ignore everything that happens after the first conversion. For the purposes of a homepage-only audit, the evidence is indirect but real: Is there a newsletter or content subscription that captures ongoing attention? Is there a community, a help center, an upgrade path visible from the homepage? Does the site acknowledge that customers have a life after purchase, or does it treat conversion as the end of the story? Retention infrastructure is almost always underdeveloped relative to acquisition on SMB and mid-market sites, and it's usually the highest-ROI investment available to a company that has already figured out how to get customers.

The `biggest_lever` output field should be treated as the primary deliverable of this agent. Every other finding is supporting evidence. The single most important strategic change — the one that, if made, shifts the trajectory rather than just improving a metric — is the output a client will remember and act on.

---

## Prompt Engineering: Translating Briefs into Agent Instructions

### The core problem the briefs solve

The current agent prompts produce rubric-checklist analysis: evaluate these five dimensions, score each one, output JSON. That structure produces consistent output format but shallow reasoning — the model scores what's present or absent without forming a diagnostic thesis about what actually matters. The briefs introduce expert reasoning frameworks. The prompt engineering problem is translating those frameworks into directive language that changes how the model reasons before it scores, without breaking the structured JSON output.

### Structural principle: reasoning-first, then scoring

The most important change is sequencing. In the current prompts, the rubric dimensions appear immediately after the role declaration. The model dives into scoring. The briefs should appear as explicit diagnostic steps that run before the dimension rubrics — establishing the analytical frame the model should be in when it encounters those rubrics.

The proposed prompt structure for each agent:

```
1. Role + expert framing (2-3 sentences establishing who this analyst is and how they think)
2. Diagnostic approach (the brief's core frameworks, made imperative)
   — Primary diagnostic lens
   — Specific tests to apply before scoring
   — What to identify as the single highest-leverage issue
3. Scoring rubrics (unchanged in structure, but now reached after framing)
4. Output format (unchanged — strict JSON)
```

The key instruction pattern is "before scoring" phrasing. It forces the model to complete a reasoning step prior to distributing scores across dimensions, which changes the scores rather than just adding prose.

---

### Conversion agent

**What to add:**

Open with the BJ Fogg diagnostic frame as an explicit step:

> Before scoring any dimension, identify what this page is asking the visitor to do and classify the most likely reason they won't do it. Use the Behavior Model: is this a motivation failure (the page hasn't made the case for why this matters to this person right now), an ability failure (too many steps, too many fields, too much perceived risk, too much to figure out), or a prompt failure (the CTA appears before the visitor is ready, or disappears when they finally are)? Name the failure mode. The remedies are categorically different and the diagnosis should drive the critical findings.

Add the skeptic's read as a named instruction for social proof evaluation:

> Evaluate social proof not by whether it exists but by whether it would move a skeptic who has been burned by a product or service in this category before. "Trusted by thousands" is not social proof. "We reduced customer acquisition cost by 40% in 90 days — [company name]" is. For each credibility claim, ask: is this specific and verifiable enough to change a skeptic's prior? Flag unearned claims explicitly.

Add highest-leverage finding as an explicit instruction:

> Before writing critical_fixes, identify the single change that would make the most difference to conversion. This is your lead finding. State it first.

**Where it goes in the prompt:** As a "Diagnostic Approach" section inserted between the role declaration and the current dimension rubrics.

---

### Content agent

**What to add:**

Open with the five-second hierarchy as a literal first step:

> Before evaluating anything else, read the page once, quickly, as a first-time visitor would — top to bottom, no going back. What impression forms in the first five seconds? The hierarchy of scrutiny is strict: headline → subheadline → hero CTA → supporting proof → body copy. A weak headline is not rescued by good body copy because most visitors never reach it. Weight your analysis accordingly.

Add the substitution test as an explicit instruction:

> Apply the substitution test to the core value proposition: replace the company name with a direct competitor. If the claim reads true for them too, the positioning has not done its job. Flag undifferentiated positioning explicitly — this is often the highest-leverage finding on the page.

Add the "so what" ladder:

> For each major claim the page makes, trace it down the "so what" ladder until you reach a concrete human outcome. A claim that bottoms out in a feature or attribute ("enterprise-grade security," "seamless integration") rather than a transformation has not completed its job. Note which claims make it to outcomes and which don't.

Add the customer language test:

> Check whether the page uses customer language (how a real buyer describes their own problem) or company language (how the company describes its product). "You're losing 70% of people who add something to cart before checkout" is customer language. "We help e-commerce brands reduce cart abandonment" is company language. They describe the same reality; the first creates recognition. Flag the gap when it's present.

**Where it goes:** As a "Diagnostic Approach" section before the rubrics, same as above.

---

### SEO agent

**What to add:**

Make crawlability-first a literal Step 0 that precedes all dimension scoring:

> Before evaluating any SEO dimension, answer this question from the HTML: can Google find, crawl, and index this page? Check: canonical tag (present? self-referencing? pointing elsewhere?), robots meta directive (index/noindex, follow/nofollow), and any obvious crawl blocks. If indexation is compromised, flag it as Critical and note that all downstream SEO work is contingent on resolving it first.

Add mechanistic PageSpeed interpretation as explicit instruction:

> When interpreting PageSpeed scores, form a hypothesis about root cause — don't just report the number. LCP above 4s is almost always an unoptimized hero image, a render-blocking resource in the document head, or a slow server response. High CLS is almost always images without explicit dimensions or dynamic content loading without reserved space. High TBT points to long JavaScript tasks on the main thread. Name the likely cause category in your finding, not just the metric value.

Add the discoverability intent read:

> After evaluating individual signals, step back and assess discoverability intent as a whole. A site with a weak title, no H1, no schema, and no tracking isn't missing three boxes — it's a site where no one has thought systematically about organic discoverability. State that directly when it's true. It usually means the problems extend beyond what's visible on the homepage.

**Where it goes:** As a "Diagnostic Approach" section. The crawlability check should be called out as "Step 0: Foundation Check" to signal its priority over everything that follows.

---

### Competitive agent

**What to add:**

Open with the shortlist-buyer frame as an explicit diagnostic step:

> Before scoring any dimension, establish what a buyer in active comparison mode would need to see to choose this company over alternatives they've already evaluated. Read the page as that buyer. The central diagnostic question is: does this site know it has competitors, and does it answer the question "why you over the alternatives" in a way that survives scrutiny?

Add the differentiation audit as an explicit instruction:

> Apply the two-filter differentiation test to the core positioning claims. Filter one: could a direct competitor make the same claim without changing a word? Filter two: is the claim grounded in something structural — a proprietary process, a specific niche, a measurable outcome, a delivery model — that a competitor couldn't copy by updating their homepage? Claims that fail either filter are undifferentiated. Flag them specifically. Undifferentiated companies compete on price by default; that's the downstream consequence worth naming.

Add the objection map instruction:

> Identify the three most likely objections a comparison-stage buyer in this category would bring to the page. Check whether the page addresses each one directly or leaves it for the buyer to fill in with skepticism. Name the unaddressed objections — these are often where deals are lost, and they're almost always observable by their absence.

Add the GSC query lens when data is available:

> If GSC query data is provided, check for comparison and alternative search terms ("X vs Y", "best X for Y", "X alternative"). Presence or absence of these queries in the site's impression data is direct evidence of how the market positions this company in evaluation contexts.

**Where it goes:** As a "Diagnostic Approach" section before the dimension rubrics. The differentiation test and objection map are the two most important steps and should be called out explicitly.

---

### Strategy agent

**What to add:**

Open with the business model diagnostic as the first step:

> Before scoring any dimension, infer the business model from the page: high-volume transaction, consultative/relationship sale, subscription with retention requirements, local service, or other. Then ask whether the marketing infrastructure on this page is built for that model. A consultative firm with no team visibility and no thought leadership has a structural mismatch. A subscription business with no email capture and no retention signals is investing in acquisition while leaking retention. Name the mismatch when it's present — this is a strategic finding, not an execution note.

Add the channel coherence frame:

> Evaluate acquisition channels not by count but by coherence. Do the channels in use reinforce each other — SEO building authority that makes paid more efficient, content driving organic that feeds email — or are they isolated bets with no compounding logic? When GA4 channel data is available, use actual session mix as evidence of what the company has built, not inference from the homepage alone.

Add the retention signal read:

> Assess whether the site acknowledges that customers have a life after first conversion. Look for: newsletter or content subscription, community signals, upgrade paths, help/onboarding content visible from the homepage. Retention infrastructure is almost always underdeveloped relative to acquisition on SMB and mid-market sites. Note its absence when it's present — it's usually the highest-ROI investment available to a company that already knows how to acquire customers.

Reinforce the biggest_lever as the primary output:

> The `biggest_lever` field is the primary deliverable of this analysis. All other findings are supporting evidence. Identify the single strategic change — not a copy tweak or a missing page, but a structural shift in how this company's marketing is architected — that would change the trajectory. Write it as a specific, actionable recommendation, not a general observation.

**Where it goes:** Same structure — "Diagnostic Approach" section before the rubrics, with the business model inference called out as Step 0.

---

### What not to do

Don't paste the briefs verbatim into the prompts. They're written as background for a human reader — discursive, explanatory, building intuition. Prompts need imperative instructions: "apply the substitution test," "classify the failure mode," "form a root cause hypothesis." Extract the operative moves and translate them into directives.

Don't add so much diagnostic instruction that the model starts producing reasoning prose before the JSON. The output format must remain strict JSON. The diagnostic steps run inside the model's reasoning process, not as visible output. If chain-of-thought behavior is showing up in the output, add an explicit reminder at the end of the diagnostic section: "Complete all diagnostic steps internally before producing any output. Output JSON only — no prose, no markdown, no summary before the JSON object."

Don't try to apply all three lenses to every dimension score. The diagnostic framing informs how the model approaches the whole analysis; individual rubrics still score their specific dimension. The synthesis of the overall diagnostic thesis belongs in the `critical_fixes` and `wins` fields — not distributed as commentary across every dimension finding.