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
  systemPrompt: string
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
  generator?: string | null
}

interface FirecrawlMetadata {
  title?: string
  description?: string
  'og:title'?: string
  'og:description'?: string
  'og:image'?: string
  generator?: string
  language?: string
  canonical?: string
  robots?: string
  sourceURL?: string
  [key: string]: string | undefined
}

interface FirecrawlResult {
  markdown: string
  metadata: FirecrawlMetadata
  links: string[]
}

interface PageAnalyzed {
  url: string
  status: 'fetched' | 'timeout' | 'error' | 'skipped'
  chars: number
  agents: AgentKey[]
}

interface InteriorPageContent {
  url: string
  path: string
  content: string
  agents: AgentKey[]
}

const PAGE_CONFIG: Array<{
  patterns: string[]
  score: number
  agents: AgentKey[]
}> = [
  {
    patterns: ['/pricing', '/plans', '/packages', '/rates', '/investment'],
    score: 10,
    agents: ['conversion', 'competitive'],
  },
  {
    patterns: ['/about', '/about-us', '/our-story', '/team', '/who-we-are'],
    score: 9,
    agents: ['strategy', 'content'],
  },
  {
    patterns: ['/services', '/solutions', '/products', '/offerings', '/what-we-do', '/work'],
    score: 9,
    agents: ['competitive', 'content', 'strategy'],
  },
  {
    patterns: ['/contact', '/demo', '/book', '/get-started', '/schedule', '/consultation'],
    score: 7,
    agents: ['conversion'],
  },
  {
    patterns: ['/how-it-works', '/process', '/approach', '/methodology'],
    score: 6,
    agents: ['strategy', 'content'],
  },
  {
    patterns: ['/case-studies', '/portfolio', '/results', '/clients', '/success'],
    score: 5,
    agents: ['competitive', 'strategy'],
  },
]

const SKIP_PATTERNS = [
  '/blog', '/news', '/press', '/privacy', '/terms', '/legal',
  '/login', '/app', '/dashboard', '/wp-admin', '/cdn', '/assets',
]

function scoreLink(path: string): { score: number; agents: AgentKey[] } | null {
  const lpath = path.toLowerCase()

  // Skip list — never fetch
  if (SKIP_PATTERNS.some((p) => lpath.includes(p))) return null
  // Skip date patterns like /2024/ or /2025/
  if (/\/20\d\d\//.test(lpath)) return null

  for (const config of PAGE_CONFIG) {
    if (config.patterns.some((p) => lpath.includes(p))) {
      return { score: config.score, agents: config.agents }
    }
  }

  // No match — strict mode, skip unrecognized URLs
  return null
}

async function firecrawlFetch(url: string, timeout = 8000): Promise<FirecrawlResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'links'], maxAge: 0 }),
      signal: AbortSignal.timeout(timeout),
    })
    if (!res.ok) return null
    const data = await res.json() as { success: boolean; data?: { markdown?: string; metadata?: FirecrawlMetadata; links?: string[] } }
    if (!data.success || !data.data) return null
    const markdown = (data.data.markdown ?? '').replace(/!\[.*?\]\(.*?\)\n?/g, '')
    return { markdown, metadata: data.data.metadata ?? {}, links: data.data.links ?? [] }
  } catch {
    return null
  }
}

function filterSameDomainLinks(links: string[], baseUrl: string): string[] {
  const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '')
  const seen = new Set<string>()
  const result: string[] = []
  for (const link of links) {
    try {
      const u = new URL(link)
      if (u.hostname.replace(/^www\./, '') !== baseHost) continue
      if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|webp|ico|css|js|xml|txt)$/i.test(u.pathname)) continue
      const normalized = u.origin + (u.pathname.replace(/\/$/, '') || '/')
      if (seen.has(normalized)) continue
      seen.add(normalized)
      result.push(normalized)
    } catch { continue }
  }
  return result
}

function metadataFromFirecrawl(meta: FirecrawlMetadata, markdown: string): PageMetadata {
  const h1s = markdown.split('\n')
    .filter(line => /^# /.test(line))
    .map(line => line.replace(/^# /, '').trim())
    .slice(0, 3)
  const wordCount = markdown.split(/\s+/).filter(w => w.length > 2).length
  return {
    title: meta.title ?? null,
    metaDescription: meta.description ?? null,
    canonical: meta.canonical ?? meta.sourceURL ?? null,
    h1s,
    wordCount,
    hasStructuredData: false,
    hasOgTags: 'og:title' in meta || 'og:description' in meta,
    metaRobots: meta.robots ?? null,
    generator: meta.generator ?? null,
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  // Normalize: strip www for comparison so www.example.com and example.com are treated as same site
  const baseHost = base.hostname.replace(/^www\./, '')
  const seen = new Set<string>()
  const links: string[] = []

  const hrefRegex = /href=["']([^"'#?][^"']*?)["']/gi
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim()
    if (!raw) continue

    let resolved: URL
    try {
      resolved = new URL(raw, base)
    } catch {
      continue
    }

    // Same site only — normalize www for comparison
    if (resolved.hostname.replace(/^www\./, '') !== baseHost) continue

    // Path-only, no fragments, no file extensions
    const path = resolved.pathname
    if (path === '/' || path === base.pathname) continue
    if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|webp|ico|css|js|xml|txt)$/i.test(path)) continue

    const normalized = path.replace(/\/$/, '') || '/'
    if (seen.has(normalized)) continue
    seen.add(normalized)
    links.push(resolved.origin + normalized)
  }

  return links
}

function selectInteriorPages(links: string[], maxPages = 3): Array<{ url: string; path: string; score: number; agents: AgentKey[] }> {
  const scored: Array<{ url: string; path: string; score: number; agents: AgentKey[] }> = []

  for (const url of links) {
    const path = new URL(url).pathname
    const result = scoreLink(path)
    if (!result || result.score === 0) continue
    scored.push({ url, path, score: result.score, agents: result.agents })
  }

  // Sort by score desc (ties preserved in order of appearance)
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, maxPages)
}

async function fetchInteriorPage(url: string): Promise<{ content: string; chars: number; status: 'fetched' | 'timeout' | 'error' }> {
  const fc = await firecrawlFetch(url, 8000)
  if (fc) {
    const truncated = fc.markdown.slice(0, 3000)
    return { content: truncated, chars: truncated.length, status: 'fetched' }
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingAuditBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return { content: '', chars: 0, status: 'error' }
    }
    const html = await response.text()
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    const truncated = stripped.slice(0, 3000)
    return { content: truncated, chars: truncated.length, status: 'fetched' }
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    return { content: '', chars: 0, status: isTimeout ? 'timeout' : 'error' }
  }
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

async function fetchPageContent(url: string): Promise<{ content: string; metadata: PageMetadata; links: string[] }> {
  const emptyMetadata: PageMetadata = {
    title: null, metaDescription: null, canonical: null,
    h1s: [], wordCount: 0, hasStructuredData: false, hasOgTags: false, metaRobots: null,
  }

  const fc = await firecrawlFetch(url, 10000)
  if (fc) {
    const content = fc.markdown.slice(0, 15000)
    const metadata = metadataFromFirecrawl(fc.metadata, fc.markdown)
    const links = filterSameDomainLinks(fc.links, url)
    return { content, metadata, links }
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingAuditBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await response.text()
    const metadata = extractPageMetadata(html)
    const links = extractLinks(html, url)
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    return { content: stripped.slice(0, 15000), metadata, links }
  } catch {
    return {
      content: `Unable to fetch page content from ${url}. Analyze based on URL structure and domain name alone.`,
      metadata: emptyMetadata,
      links: [],
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
Page content:
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
    systemPrompt: agent.systemPrompt,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  }
}

async function runSummaryAgent(
  agentResults: AgentRunResult[],
  businessContext: string | null,
): Promise<{ result: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number } }> {
  const agentOutputs = Object.fromEntries(
    agentResults.map(({ key, result }) => {
      const agent = AGENTS.find((a) => a.key === key)!
      return [agent.label, result]
    })
  )

  const userMessage = `${businessContext ? `${businessContext}\n\n` : ''}Here are the five agent analysis outputs for this site. Synthesize them into an executive summary.\n\n${JSON.stringify(agentOutputs, null, 2)}\n\nReturn ONLY the JSON summary object. No prose, no markdown.`

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
  pageMetadata: PageMetadata | null
  pagesAnalyzed: Array<{ url: string; status: string; chars: number; agents: AgentKey[] }>
  agents: Array<{
    key: string
    score: number
    inputTokens: number
    outputTokens: number
    userMessage: string
    systemPrompt: string
    result: Record<string, unknown>
  }>
  summary: Record<string, unknown> | null
  summaryTokens: { input: number; output: number }
  businessType: string
  conversionGoal: string
  targetCustomer: string
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
  reportUrl: string
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

  const { name, company, url, reportUrl, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed } = payload
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
          { name: 'Report', value: reportUrl, inline: false },
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
  const businessType = searchParams.get('businessType') ?? ''
  const conversionGoal = searchParams.get('conversionGoal') ?? ''
  const targetCustomer = searchParams.get('targetCustomer') ?? ''

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

  const businessContextParts = businessType && conversionGoal
    ? [
        '## Business Context (operator-supplied)',
        `- Business type: ${businessType}`,
        `- Primary conversion goal: ${conversionGoal}`,
        ...(targetCustomer ? [`- Target customer: ${targetCustomer}`] : []),
      ].join('\n')
    : null
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const auditId = crypto.randomUUID()
      const auditor = company ? `${name} @ ${company}` : name

      notifyDiscordStart({ name, company, url: targetUrl }).catch(() => { /* non-critical */ })

      send({ type: 'start', url: targetUrl, message: 'Fetching page content & PageSpeed data...' })

      // Fetch HTML, PageSpeed, crawl data, GSC/GA4, and DataForSEO competitive data in parallel.
      // Both /api/connected-data and /api/competitive-data run on Node runtime to avoid Edge constraints.
      const origin = new URL(request.url).origin
      const [pageData, pageSpeed, crawlData, connectedData, competitiveData] = await Promise.all([
        fetchPageContent(targetUrl),
        fetchPageSpeed(targetUrl),
        fetchRobotsAndSitemap(targetUrl),
        fetch(`${origin}/api/connected-data?siteUrl=${encodeURIComponent(targetUrl)}`)
          .then((r) => r.json() as Promise<{ gscContext: string | null; ga4Context: string | null }>)
          .catch(() => ({ gscContext: null, ga4Context: null })),
        fetch(`${origin}/api/competitive-data?siteUrl=${encodeURIComponent(targetUrl)}`)
          .then((r) => r.json() as Promise<{ rankContext: string | null; competitorsContext: string | null }>)
          .catch(() => ({ rankContext: null, competitorsContext: null })),
      ])
      const { content: pageContent, metadata: pageMetadata, links: homepageLinks } = pageData
      const { gscContext, ga4Context } = connectedData
      const { rankContext, competitorsContext } = competitiveData
      const isConnected = gscContext !== null || ga4Context !== null
      const isCompetitive = rankContext !== null || competitorsContext !== null

      // Select and fetch interior pages (after homepage, before agents launch)
      const selectedPages = selectInteriorPages(homepageLinks)
      const interiorResults = await Promise.allSettled(
        selectedPages.map((p) => fetchInteriorPage(p.url).then((r) => ({ ...p, ...r })))
      )

      const pagesAnalyzed: Array<{ url: string; status: 'fetched' | 'timeout' | 'error' | 'skipped'; chars: number; agents: AgentKey[] }> = []
      const fetchedInteriorPages: InteriorPageContent[] = []

      for (let i = 0; i < interiorResults.length; i++) {
        const sel = selectedPages[i]
        const res = interiorResults[i]
        if (res.status === 'fulfilled') {
          const { path, content, chars, status, agents } = res.value
          pagesAnalyzed.push({ url: path, status, chars, agents: status === 'fetched' ? agents : [] })
          if (status === 'fetched') {
            fetchedInteriorPages.push({ url: sel.url, path, content, agents })
          }
        } else {
          pagesAnalyzed.push({ url: sel.path, status: 'error', chars: 0, agents: [] })
        }
      }

      // Data pipeline visibility log
      console.log(`\n[audit] ── ${targetUrl} ──────────────────────`)
      console.log(`[audit] HTML: ${pageContent.length} chars | PageSpeed: ${pageSpeed ? `perf=${pageSpeed.scores.performance}` : 'unavailable'} | crawl: ${crawlData ? `${crawlData.length} chars` : 'none'}`)
      console.log(`[audit] interior pages: ${fetchedInteriorPages.length}/${selectedPages.length} fetched — ${pagesAnalyzed.map((p) => `${p.url}(${p.status})`).join(', ') || 'none'}`)
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

      const interiorPageCount = fetchedInteriorPages.length
      send({
        type: 'fetched',
        message: `Page fetched${pageSpeed ? ' + PageSpeed ✓' : ''}${crawlData ? ' + robots/sitemap ✓' : ''}${interiorPageCount > 0 ? ` + ${interiorPageCount} interior page${interiorPageCount > 1 ? 's' : ''} ✓` : ''}${isConnected ? ' + GSC/GA4 ✓' : ''}${isCompetitive ? ' + Intel APIs ✓' : ''}. Building your datalytics...`,
        pageSpeed,
        metadata: pageMetadata,
        connected: isConnected,
        competitive: isCompetitive,
        pagesAnalyzed: pagesAnalyzed.map(({ url, status }) => ({ url, status })),
      })

      fetch(`${origin}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'init',
          data: { id: auditId, timestamp: new Date().toISOString(), url: targetUrl, auditor },
        }),
      }).catch(() => {})

      const agentKeys: AgentKey[] = ['content', 'conversion', 'competitive', 'technical', 'strategy']

      // Per PRD: which agents get which data sources
      const GSC_AGENTS = new Set(['technical', 'strategy', 'competitive', 'content'])
      const GA4_AGENTS = new Set(['technical', 'strategy', 'competitive', 'content', 'conversion'])
      const RANK_AGENTS = new Set(['technical', 'strategy'])
      const COMPETITORS_AGENTS = new Set(['competitive', 'strategy'])

      const promises = agentKeys.map(async (key) => {
        const parts: (string | null)[] = [businessContextParts]
        if (key === 'technical') {
          parts.push(pageSpeed ? formatPageSpeedContext(pageSpeed) : null)
          parts.push(crawlData || null)
        }
        if (gscContext && GSC_AGENTS.has(key)) parts.push(gscContext)
        if (ga4Context && GA4_AGENTS.has(key)) parts.push(ga4Context)
        if (rankContext && RANK_AGENTS.has(key)) parts.push(rankContext)
        if (competitorsContext && COMPETITORS_AGENTS.has(key)) parts.push(competitorsContext)
        // Append interior page content for pages routed to this agent
        for (const page of fetchedInteriorPages) {
          if (page.agents.includes(key)) {
            parts.push(`## Interior Page: ${page.path}\n${page.content}`)
          }
        }
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
          fetch(`${origin}/api/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'agent',
              data: { id: auditId, key, result: agentResult.result },
            }),
          }).catch(() => {})
          return agentResult
        } catch (err) {
          const fallback: AgentRunResult = {
            key,
            result: { score: 0, error: String(err) },
            userMessage: '',
            systemPrompt: AGENTS.find((a) => a.key === key)?.systemPrompt ?? '',
            usage: { input_tokens: 0, output_tokens: 0 },
          }
          send({ type: 'agent_complete', key, result: fallback.result, usage: fallback.usage })
          fetch(`${origin}/api/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'agent',
              data: { id: auditId, key, result: fallback.result },
            }),
          }).catch(() => {})
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
        const summary = await runSummaryAgent(results, businessContextParts)
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

      // Write Neon BEFORE sending complete — ensures the report page has full data
      // the moment the browser navigates to it. The user's experience is unchanged
      // since the audit has already been running for 30+ seconds.
      await writeAuditLog(origin, {
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
        pageMetadata,
        pagesAnalyzed,
        agents: results.map(({ key, result, userMessage, systemPrompt, usage }) => ({
          key,
          score: (result.score as number) || 0,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          userMessage,
          systemPrompt,
          result,
        })),
        summary: summaryResult,
        summaryTokens: { input: summaryUsage.input_tokens, output: summaryUsage.output_tokens },
        businessType,
        conversionGoal,
        targetCustomer,
      })

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

      await notifyDiscord({ name, company, url: targetUrl, reportUrl: `${origin}/audit/${auditId}`, compositeScore, scores, totalInputTokens, totalOutputTokens, model, durationMs, pageSpeed })
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
