import Anthropic from '@anthropic-ai/sdk'
import { AGENTS, WEIGHTS, AgentKey } from '@/lib/agents'

export const runtime = 'edge'
export const maxDuration = 120

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface AgentRunResult {
  key: AgentKey
  result: Record<string, unknown>
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

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingAuditBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await response.text()
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    return stripped.slice(0, 15000)
  } catch {
    return `Unable to fetch page content from ${url}. Analyze based on URL structure and domain name alone.`
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

  const userMessage = `Analyze this website for the ${agent.category} dimension.

URL: ${url}
${additionalContext ? `\n${additionalContext}\n` : ''}
Page HTML content:
${pageContent}

Provide your analysis as a JSON object only. No explanation, no markdown, no code blocks — just the raw JSON.`

  const message = await client.messages.create({
    model: (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6') as string,
    max_tokens: 2048,
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let result: Record<string, unknown>
  try {
    result = JSON.parse(cleaned)
  } catch {
    result = { score: 50, error: 'Parse error', raw: cleaned.slice(0, 200) }
  }

  return {
    key: agentKey,
    result,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  }
}

async function notifyDiscord(payload: {
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

  const { url, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed } = payload
  const totalTokens = totalInputTokens + totalOutputTokens
  const estimatedCost = ((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4)
  const duration = (durationMs / 1000).toFixed(1)

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
        title: 'Marketing Audit Complete',
        url,
        color: compositeScore >= 75 ? 0x16a34a : compositeScore >= 55 ? 0xca8a04 : 0xdc2626,
        fields: [
          { name: 'Overall Score', value: `**${compositeScore}/100**`, inline: true },
          { name: 'Duration', value: `${duration}s`, inline: true },
          { name: 'Model', value: model, inline: true },
          { name: 'Agent Scores', value: agentLines, inline: false },
          { name: 'PageSpeed Insights', value: psField, inline: false },
          { name: 'Token Usage', value: `↑ ${totalInputTokens.toLocaleString()} in  ↓ ${totalOutputTokens.toLocaleString()} out  (${totalTokens.toLocaleString()} total)`, inline: false },
          { name: 'Cost', value: `~$${estimatedCost}`, inline: true },
        ],
        footer: { text: url },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

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

      send({ type: 'start', url: targetUrl, message: 'Fetching page content & PageSpeed data...' })

      // Fetch HTML and PageSpeed in parallel
      const [pageContent, pageSpeed, crawlData] = await Promise.all([
        fetchPageContent(targetUrl),
        fetchPageSpeed(targetUrl),
        fetchRobotsAndSitemap(targetUrl),
      ])

      send({
        type: 'fetched',
        message: `Page fetched${pageSpeed ? ' + PageSpeed data ✓' : ''}${crawlData ? ' + robots/sitemap ✓' : ''}. Launching 5 parallel agents...`,
        pageSpeed,
      })

      const agentKeys: AgentKey[] = ['content', 'conversion', 'competitive', 'technical', 'strategy']

      const promises = agentKeys.map(async (key) => {
        // Only pass PageSpeed + crawl data to the technical agent
        const additionalContext = key === 'technical'
          ? [pageSpeed ? formatPageSpeedContext(pageSpeed) : null, crawlData || null].filter(Boolean).join('\n\n') || undefined
          : undefined

        try {
          const agentResult = await runAgent(key, targetUrl, pageContent, additionalContext)
          send({ type: 'agent_complete', key, result: agentResult.result, usage: agentResult.usage })
          return agentResult
        } catch (err) {
          const fallback: AgentRunResult = {
            key,
            result: { score: 0, error: String(err) },
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

      const totalInputTokens = results.reduce((s, r) => s + r.usage.input_tokens, 0)
      const totalOutputTokens = results.reduce((s, r) => s + r.usage.output_tokens, 0)
      const durationMs = Date.now() - startTime
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
      const scores = Object.fromEntries(results.map(({ key, result }) => [key, ((result.score as number) || 0)]))

      send({
        type: 'complete',
        compositeScore,
        scores,
        pageSpeed,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          estimatedCostUsd: parseFloat(((totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000).toFixed(4)),
        },
        durationMs,
        model,
      })

      await notifyDiscord({ url: targetUrl, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed })
        .catch(() => { /* non-critical */ })

      controller.close()
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
