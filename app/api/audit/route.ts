import Anthropic from '@anthropic-ai/sdk'
import { AGENTS, WEIGHTS, AgentKey, SUMMARY_SYSTEM_PROMPT } from '@/lib/agents'

export const runtime = 'edge'
export const maxDuration = 120

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface AgentRunResult {
  key: AgentKey
  result: Record<string, unknown>
  userMessage: string
  usage: { input_tokens: number; output_tokens: number }
}

interface PageSpeedData {
  scores: {
    performance: number
    accessibility: number
    seo: number
    bestPractices: number
  }
  metrics: {
    fcp: string
    lcp: string
    tbt: string
    cls: string
    speedIndex: string
    tti: string
  }
  opportunities: string[]
  diagnostics: string[]
  error?: string
}

interface PageMetadata {
  title: string | null
  metaDescription: string | null
  canonical: string | null
  h1s: string[]
  wordCount: number
  hasStructuredData: boolean
  hasOgTags: boolean
  metaRobots: string | null
}

function extractPageMetadata(html: string): PageMetadata {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null

  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i)?.[1]?.trim() ??
    null

  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)?.[1]?.trim() ??
    html.match(/<link[^>]+href=["']([^"']*)[^>]+rel=["']canonical["']/i)?.[1]?.trim() ??
    null

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
  const h1s = h1Matches
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3)

  const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = textOnly.split(' ').filter((w) => w.length > 2).length

  const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["']/i.test(html)
  const hasOgTags = /<meta[^>]+property=["']og:/i.test(html)

  const metaRobots =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']robots["']/i)?.[1]?.trim() ??
    null

  return { title, metaDescription, canonical, h1s, wordCount, hasStructuredData, hasOgTags, metaRobots }
}

async function fetchRobotsAndSitemap(url: string): Promise<string> {
  try {
    const origin = new URL(url).origin
    const [robotsRes, sitemapRes] = await Promise.allSettled([
      fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
    ])

    const parts: string[] = []

    if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
      const text = await robotsRes.value.text()
      parts.push(`## robots.txt\n${text.slice(0, 2000)}`)
    }

    if (sitemapRes.status === 'fulfilled' && sitemapRes.value.ok) {
      const text = await sitemapRes.value.text()
      parts.push(`## sitemap.xml (truncated)\n${text.slice(0, 2000)}`)
    }

    return parts.join('\n\n')
  } catch {
    return ''
  }
}

async function fetchPageContent(url: string): Promise<{ content: string; metadata: PageMetadata }> {
  const emptyMetadata: PageMetadata = {
    title: null, metaDescription: null, canonical: null,
    h1s: [], wordCount: 0, hasStructuredData: false, hasOgTags: false, metaRobots: null,
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingAuditBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await response.text()
    const metadata = extractPageMetadata(html)
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    return { content: stripped.slice(0, 15000), metadata }
  } catch {
    return {
      content: `Unable to fetch page content from ${url}. Analyze based on URL structure and domain name alone.`,
      metadata: emptyMetadata,
    }
  }
}

async function fetchPageSpeed(url: string): Promise<PageSpeedData | null> {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
    const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    const params = new URLSearchParams({
      url,
      strategy: 'mobile',
      category: 'performance',
    })
    // Add all categories
    const fullParams = `${params.toString()}&category=accessibility&category=seo&category=best-practices${apiKey ? `&key=${apiKey}` : ''}`

    const res = await fetch(`${base}?${fullParams}`, {
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return null
    const data = await res.json() as {
      lighthouseResult?: {
        categories?: Record<string, { score: number }>
        audits?: Record<string, { displayValue?: string; title?: string; score?: number; details?: { type: string } }>
      }
    }
    const lr = data.lighthouseResult
    if (!lr) return null

    const cat = lr.categories ?? {}
    const audits = lr.audits ?? {}

    const score = (key: string) => Math.round((cat[key]?.score ?? 0) * 100)
    const metric = (key: string) => audits[key]?.displayValue ?? 'N/A'

    // Pull failed opportunities (score < 0.9, has details of type 'opportunity')
    const opportunities = Object.values(audits)
      .filter((a) => a.score !== null && (a.score ?? 1) < 0.9 && a.details?.type === 'opportunity')
      .map((a) => a.title ?? '')
      .filter(Boolean)
      .slice(0, 5)

    // Pull notable diagnostics
    const diagnostics = Object.values(audits)
      .filter((a) => a.score !== null && (a.score ?? 1) < 0.5 && a.details?.type === 'table')
      .map((a) => a.title ?? '')
      .filter(Boolean)
      .slice(0, 5)

    return {
      scores: {
        performance: score('performance'),
        accessibility: score('accessibility'),
        seo: score('seo'),
        bestPractices: score('best-practices'),
      },
      metrics: {
        fcp: metric('first-contentful-paint'),
        lcp: metric('largest-contentful-paint'),
        tbt: metric('total-blocking-time'),
        cls: metric('cumulative-layout-shift'),
        speedIndex: metric('speed-index'),
        tti: metric('interactive'),
      },
      opportunities,
      diagnostics,
    }
  } catch {
    return null
  }
}

function formatPageSpeedContext(ps: PageSpeedData): string {
  return `
## Real PageSpeed Insights Data (Mobile)

### Lighthouse Scores
| Category | Score |
|---|---|
| Performance | ${ps.scores.performance}/100 |
| Accessibility | ${ps.scores.accessibility}/100 |
| SEO | ${ps.scores.seo}/100 |
| Best Practices | ${ps.scores.bestPractices}/100 |

### Core Web Vitals
| Metric | Value |
|---|---|
| First Contentful Paint (FCP) | ${ps.metrics.fcp} |
| Largest Contentful Paint (LCP) | ${ps.metrics.lcp} |
| Total Blocking Time (TBT) | ${ps.metrics.tbt} |
| Cumulative Layout Shift (CLS) | ${ps.metrics.cls} |
| Speed Index | ${ps.metrics.speedIndex} |
| Time to Interactive (TTI) | ${ps.metrics.tti} |

### Top Opportunities (Lighthouse flagged)
${ps.opportunities.length > 0 ? ps.opportunities.map((o) => `- ${o}`).join('\n') : '- None flagged'}

### Diagnostics
${ps.diagnostics.length > 0 ? ps.diagnostics.map((d) => `- ${d}`).join('\n') : '- None flagged'}

IMPORTANT: Use these REAL numbers in your scoring and analysis. Do not estimate or guess performance metrics — the above data is authoritative.
`.trim()
}

async function runAgent(
  agentKey: AgentKey,
  url: string,
  pageContent: string,
  additionalContext?: string,
): Promise<AgentRunResult> {
  const agent = AGENTS.find((a) => a.key === agentKey)!

  const userMessage = `Analyze this website for the ${agent.label} dimension.

URL: ${url}
${additionalContext ? `\n${additionalContext}\n` : ''}
Page HTML content:
${pageContent}

Provide your analysis as a JSON object only. No explanation, no markdown, no code blocks — just the raw JSON.`

  const message = await client.messages.create({
    model: (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6') as string,
    max_tokens: 2048,
    temperature: 0.2,
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  console.log(`[agent:${agentKey}] stop_reason=${message.stop_reason} in=${message.usage.input_tokens} out=${message.usage.output_tokens}${additionalContext ? ` context=${additionalContext.length}chars` : ''}`)

  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let result: Record<string, unknown>
  try {
    result = JSON.parse(cleaned)
  } catch {
    console.error(`[agent:${agentKey}] JSON parse failed | raw[:200]:`, cleaned.slice(0, 200))
    result = { score: 50, error: 'Parse error', raw: cleaned.slice(0, 200) }
  }

  return {
    key: agentKey,
    result,
    userMessage,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  }
}

async function runSummaryAgent(
  agentResults: AgentRunResult[]
): Promise<{ result: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number } }> {
  const agentOutputs = Object.fromEntries(
    agentResults.map(({ key, result }) => {
      const agent = AGENTS.find((a) => a.key === key)!
      return [agent.label, result]
    })
  )

  const userMessage = `Here are the five agent analysis outputs for this site. Synthesize them into an executive summary.\n\n${JSON.stringify(agentOutputs, null, 2)}\n\nReturn ONLY the JSON summary object. No prose, no markdown.`

  const message = await client.messages.create({
    model: (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6') as string,
    max_tokens: 2048,
    temperature: 0.2,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  console.log('[summary] stop_reason:', message.stop_reason, '| output_tokens:', message.usage.output_tokens)
  console.log('[summary] raw response:', text.slice(0, 500))

  // Extract the outermost JSON object, ignoring any surrounding prose or code fences
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const cleaned = jsonMatch ? jsonMatch[0] : text.trim()

  let result: Record<string, unknown>
  try {
    result = JSON.parse(cleaned)
    console.log('[summary] parsed OK — keys:', Object.keys(result).join(', '))
  } catch (e) {
    console.error('[summary] JSON parse failed:', e, '| cleaned[:200]:', cleaned.slice(0, 200))
    result = { error: 'Parse error', raw: cleaned.slice(0, 200) }
  }

  return {
    result,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  }
}

async function writeAuditLog(origin: string, payload: {
  id: string
  timestamp: string
  auditor: string
  url: string
  connected: boolean
  compositeScore: number
  durationMs: number
  model: string
  gscContext: string | null
  ga4Context: string | null
  agents: Array<{
    key: string
    score: number
    inputTokens: number
    outputTokens: number
    userMessage: string
    result: Record<string, unknown>
  }>
  summary: Record<string, unknown> | null
  summaryTokens: { input: number; output: number }
}) {
  try {
    const lines: string[] = []
    const sep = '─'.repeat(60)
    lines.push(`\n${sep}`)
    lines.push(`${payload.timestamp}  ${payload.url}`)
    lines.push(`Auditor: ${payload.auditor} | Score: ${payload.compositeScore}/100 | ${(payload.durationMs / 1000).toFixed(1)}s | ${payload.model}`)
    lines.push(`Connected: ${payload.connected}`)
    if (payload.gscContext) {
      lines.push(`\nGSC Context (${payload.gscContext.length} chars):\n${payload.gscContext}`)
    }
    if (payload.ga4Context) {
      lines.push(`\nGA4 Context (${payload.ga4Context.length} chars):\n${payload.ga4Context}`)
    }
    for (const agent of payload.agents) {
      lines.push(`\n[${agent.key}] score=${agent.score} in=${agent.inputTokens} out=${agent.outputTokens}`)
      lines.push(`--- user message (${agent.userMessage.length} chars) ---\n${agent.userMessage}\n--- end user message ---`)
      if (agent.result.dimensions) {
        const dims = agent.result.dimensions as Array<{ name: string; score: number; finding: string }>
        for (const d of dims) lines.push(`  ${d.name}: ${d.score}/10 — ${d.finding}`)
      }
      if (agent.result.biggest_lever) lines.push(`  biggest_lever: ${agent.result.biggest_lever}`)
      if (agent.result.critical_fixes) {
        const fixes = agent.result.critical_fixes as string[]
        for (const f of fixes.slice(0, 3)) lines.push(`  fix: ${f}`)
      }
    }
    if (payload.summary) {
      lines.push(`\n[summary] in=${payload.summaryTokens.input} out=${payload.summaryTokens.output}`)
      lines.push(JSON.stringify(payload.summary, null, 2))
    }
    lines.push(sep)

    await fetch(`${origin}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n'), data: payload }),
    })
  } catch {
    // non-critical
  }
}

async function notifyDiscordStart(payload: { name: string; company: string; url: string }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  const { name, company, url } = payload
  const auditor = company ? `${name} @ ${company}` : name

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: 'Audit Started',
        color: 0x2D4A6E,
        fields: [
          { name: 'Auditor', value: auditor, inline: true },
          { name: 'Site', value: url, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

async function notifyDiscord(payload: {
  name: string
  company: string
  url: string
  compositeScore: number
  scores: Record<string, number>
  totalInputTokens: number
  totalOutputTokens: number
  model: string
  durationMs: number
  pageSpeed: PageSpeedData | null
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  const { name, company, url, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed } = payload
  const totalTokens = totalInputTokens + totalOutputTokens
  const cost = ((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4)
  const duration = (durationMs / 1000).toFixed(1)
  const auditor = company ? `${name} @ ${company}` : name

  const scoreBar = (s: number) => {
    const filled = Math.round(s / 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled)
  }

  const agentLines = Object.entries(scores)
    .map(([key, score]) => `\`${scoreBar(score)}\` **${score}** — ${key}`)
    .join('\n')

  const psField = pageSpeed
    ? `Perf: **${pageSpeed.scores.performance}** | A11y: **${pageSpeed.scores.accessibility}** | SEO: **${pageSpeed.scores.seo}** | BP: **${pageSpeed.scores.bestPractices}**\nLCP: ${pageSpeed.metrics.lcp} | CLS: ${pageSpeed.metrics.cls} | TBT: ${pageSpeed.metrics.tbt}`
    : 'Not available'

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: 'Audit Complete',
        url,
        color: compositeScore >= 75 ? 0x16a34a : compositeScore >= 55 ? 0xca8a04 : 0xdc2626,
        fields: [
          { name: 'Auditor', value: auditor, inline: true },
          { name: 'Overall Score', value: `**${compositeScore}/100**`, inline: true },
          { name: 'Duration', value: `${duration}s`, inline: true },
          { name: 'Agent Scores', value: agentLines, inline: false },
          { name: 'PageSpeed Insights', value: psField, inline: false },
          { name: 'Token Usage', value: `↑ ${totalInputTokens.toLocaleString()} in  ↓ ${totalOutputTokens.toLocaleString()} out  (${totalTokens.toLocaleString()} total)`, inline: false },
          { name: 'Cost', value: `$${cost}`, inline: true },
          { name: 'Model', value: model, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const name = searchParams.get('name') ?? 'Unknown'
  const company = searchParams.get('company') ?? ''
  const inviteCode = searchParams.get('inviteCode') ?? ''

  const rawCodes = process.env.INVITE_CODES
  if (rawCodes) {
    const validCodes = rawCodes.split(',').map((s) => s.trim()).filter(Boolean)
    if (!validCodes.includes(inviteCode)) {
      return new Response(JSON.stringify({ error: 'Invalid invite code' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const targetUrl = url.startsWith('http') ? url : `https://${url}`
  const startTime = Date.now()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      notifyDiscordStart({ name, company, url: targetUrl }).catch(() => { /* non-critical */ })

      send({ type: 'start', url: targetUrl, message: 'Fetching page content & PageSpeed data...' })

      // Fetch HTML, PageSpeed, crawl data, and GSC/GA4 in parallel.
      // GSC/GA4 is fetched via /api/connected-data (Node runtime) to avoid Edge/googleapis conflict.
      // Service account auth is handled server-side — no session needed.
      const origin = new URL(request.url).origin
      const [pageData, pageSpeed, crawlData, connectedData] = await Promise.all([
        fetchPageContent(targetUrl),
        fetchPageSpeed(targetUrl),
        fetchRobotsAndSitemap(targetUrl),
        fetch(`${origin}/api/connected-data?siteUrl=${encodeURIComponent(targetUrl)}`)
          .then((r) => r.json() as Promise<{ gscContext: string | null; ga4Context: string | null }>)
          .catch(() => ({ gscContext: null, ga4Context: null })),
      ])
      const { content: pageContent, metadata: pageMetadata } = pageData
      const { gscContext, ga4Context } = connectedData
      const isConnected = gscContext !== null || ga4Context !== null

      // Data pipeline visibility log
      console.log(`\n[audit] ── ${targetUrl} ──────────────────────`)
      console.log(`[audit] HTML: ${pageContent.length} chars | PageSpeed: ${pageSpeed ? `perf=${pageSpeed.scores.performance}` : 'unavailable'} | crawl: ${crawlData ? `${crawlData.length} chars` : 'none'}`)
      if (gscContext) {
        console.log(`[audit] GSC context (${gscContext.length} chars):\n${gscContext.slice(0, 800)}`)
      } else {
        console.log('[audit] GSC context: none')
      }
      if (ga4Context) {
        console.log(`[audit] GA4 context (${ga4Context.length} chars):\n${ga4Context.slice(0, 800)}`)
      } else {
        console.log('[audit] GA4 context: none')
      }

      send({
        type: 'fetched',
        message: `Page fetched${pageSpeed ? ' + PageSpeed ✓' : ''}${crawlData ? ' + robots/sitemap ✓' : ''}${isConnected ? ' + GSC/GA4 ✓' : ''}. Launching 5 parallel agents...`,
        pageSpeed,
        metadata: pageMetadata,
        connected: isConnected,
      })

      const agentKeys: AgentKey[] = ['content', 'conversion', 'competitive', 'technical', 'strategy']

      // Per PRD: which agents get which connected data
      const GSC_AGENTS = new Set(['technical', 'strategy', 'competitive', 'content'])
      const GA4_AGENTS = new Set(['technical', 'strategy', 'competitive', 'content', 'conversion'])

      const promises = agentKeys.map(async (key) => {
        const parts: (string | null)[] = []
        if (key === 'technical') {
          parts.push(pageSpeed ? formatPageSpeedContext(pageSpeed) : null)
          parts.push(crawlData || null)
        }
        if (gscContext && GSC_AGENTS.has(key)) parts.push(gscContext)
        if (ga4Context && GA4_AGENTS.has(key)) parts.push(ga4Context)
        const additionalContext = parts.filter(Boolean).join('\n\n') || undefined

        try {
          const agentResult = await runAgent(key, targetUrl, pageContent, additionalContext)
          // Compute score from dimension averages — don't trust the LLM-generated top-level score
          const dims = agentResult.result.dimensions as Array<{ score: number }> | undefined
          if (dims?.length) {
            agentResult.result.score = Math.round(
              dims.reduce((sum, d) => sum + (d.score ?? 0), 0) / dims.length * 10
            )
          }
          send({ type: 'agent_complete', key, result: agentResult.result, usage: agentResult.usage })
          return agentResult
        } catch (err) {
          const fallback: AgentRunResult = {
            key,
            result: { score: 0, error: String(err) },
            userMessage: '',
            usage: { input_tokens: 0, output_tokens: 0 },
          }
          send({ type: 'agent_complete', key, result: fallback.result, usage: fallback.usage })
          return fallback
        }
      })

      const results = await Promise.all(promises)

      const compositeScore = Math.round(
        results.reduce((sum, { key, result }) => {
          return sum + (((result.score as number) || 0) * WEIGHTS[key])
        }, 0)
      )

      // Run executive summary agent after all five complete
      send({ type: 'summary_running', message: 'Generating executive summary...' })
      let summaryUsage = { input_tokens: 0, output_tokens: 0 }
      let summaryResult: Record<string, unknown> | null = null
      try {
        const summary = await runSummaryAgent(results)
        summaryUsage = summary.usage
        summaryResult = summary.result
        send({ type: 'summary_complete', result: summary.result, usage: summary.usage })
      } catch {
        send({ type: 'summary_complete', result: { error: 'Summary generation failed' }, usage: summaryUsage })
      }

      const totalInputTokens = results.reduce((s, r) => s + r.usage.input_tokens, 0) + summaryUsage.input_tokens
      const totalOutputTokens = results.reduce((s, r) => s + r.usage.output_tokens, 0) + summaryUsage.output_tokens
      const durationMs = Date.now() - startTime
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
      const scores = Object.fromEntries(results.map(({ key, result }) => [key, ((result.score as number) || 0)]))
      const auditId = crypto.randomUUID()

      send({
        type: 'complete',
        auditId,
        compositeScore,
        scores,
        pageSpeed,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          costUsd: parseFloat(((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4)),
        },
        durationMs,
        model,
      })

      // Close the stream immediately — do not block on post-completion side effects
      controller.close()

      const auditor = company ? `${name} @ ${company}` : name
      writeAuditLog(origin, {
        id: auditId,
        timestamp: new Date().toISOString(),
        auditor,
        url: targetUrl,
        connected: isConnected,
        compositeScore,
        durationMs,
        model,
        gscContext,
        ga4Context,
        agents: results.map(({ key, result, userMessage, usage }) => ({
          key,
          score: (result.score as number) || 0,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          userMessage,
          result,
        })),
        summary: summaryResult,
        summaryTokens: { input: summaryUsage.input_tokens, output: summaryUsage.output_tokens },
      }).catch(() => { /* non-critical */ })

      notifyDiscord({ name, company, url: targetUrl, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed })
        .catch(() => { /* non-critical */ })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
