// Node.js runtime (NOT edge) — keeps parity with /api/connected-data pattern
import { NextRequest, NextResponse } from 'next/server'

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3'

function getAuth(): string | null {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

async function callDataForSEO(auth: string, path: string, body: object): Promise<unknown> {
  const res = await fetch(`${DATAFORSEO_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([body]),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`)
  const json = await res.json() as { tasks?: Array<{ status_code?: number; result?: unknown[] }> }
  const task = json.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    console.error(`[competitive-data] DataForSEO task error: status=${task?.status_code} path=${path}`)
    throw new Error(`DataForSEO task error: ${task?.status_code}`)
  }
  return task.result?.[0]
}

interface DomainRankMetrics {
  pos_1?: number
  pos_2_3?: number
  pos_4_10?: number
  count?: number
  etv?: number
  estimated_paid_traffic_cost?: number
  is_up?: number
  is_down?: number
  is_lost?: number
}

interface DomainRankResult {
  items?: Array<{
    metrics?: {
      organic?: DomainRankMetrics
      paid?: DomainRankMetrics
    }
  }>
}

interface CompetitorItem {
  domain?: string
  avg_position?: number
  intersections?: number
  metrics?: {
    organic?: DomainRankMetrics
  }
}

interface CompetitorsResult {
  items?: CompetitorItem[] | null
}

interface RankedKeyword {
  keyword_data?: {
    keyword?: string
    keyword_info?: {
      search_volume?: number
    }
  }
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number
    }
  }
}

interface RankedKeywordsResult {
  items?: RankedKeyword[] | null
}

function formatRankContext(result: DomainRankResult, target: string): string {
  const item = result.items?.[0]
  const organic = item?.metrics?.organic
  const paid = item?.metrics?.paid

  if (!organic) return ''

  const lines = [`## DataForSEO: Domain Rankings — ${target}`]

  lines.push('\n### Organic Search Presence')
  lines.push('| Metric | Value |')
  lines.push('|---|---|')
  lines.push(`| Estimated Monthly Organic Traffic | ${Math.round(organic.etv ?? 0).toLocaleString()} visits |`)
  lines.push(`| Total Keywords Ranking | ${(organic.count ?? 0).toLocaleString()} |`)
  lines.push(`| Keywords in Position #1 | ${organic.pos_1 ?? 0} |`)
  lines.push(`| Keywords in Positions 2–3 | ${organic.pos_2_3 ?? 0} |`)
  lines.push(`| Keywords in Positions 4–10 | ${organic.pos_4_10 ?? 0} |`)
  lines.push(`| Organic Traffic Value (est.) | $${Math.round(organic.estimated_paid_traffic_cost ?? 0).toLocaleString()}/mo |`)

  const momentum = []
  if ((organic.is_up ?? 0) > 0) momentum.push(`${organic.is_up} keywords gaining`)
  if ((organic.is_down ?? 0) > 0) momentum.push(`${organic.is_down} keywords declining`)
  if ((organic.is_lost ?? 0) > 0) momentum.push(`${organic.is_lost} keywords lost`)
  if (momentum.length > 0) {
    lines.push(`| Ranking Momentum | ${momentum.join(', ')} |`)
  }

  if ((paid?.count ?? 0) > 0) {
    lines.push('\n### Paid Search Activity')
    lines.push(`Active PPC: ${paid!.count} paid keywords, ~$${Math.round(paid!.estimated_paid_traffic_cost ?? 0).toLocaleString()}/mo estimated spend`)
  } else {
    lines.push('\n**Paid Search:** No active PPC campaigns detected.')
  }

  return lines.join('\n')
}

function formatKeywordsContext(result: RankedKeywordsResult, target: string): string {
  const items = result.items
  if (!items?.length) return ''

  const lines = [`## DataForSEO: Ranked Keywords (Positions 4–20) — ${target}`]
  lines.push('\n| Keyword | Position | Monthly Searches |')
  lines.push('|---|---|---|')

  for (const item of items.slice(0, 25)) {
    const keyword = item.keyword_data?.keyword ?? '—'
    const position = item.ranked_serp_element?.serp_item?.rank_group ?? '—'
    const volume = item.keyword_data?.keyword_info?.search_volume
    lines.push(
      `| ${keyword} | ${position} | ${volume != null ? volume.toLocaleString() : '—'} |`
    )
  }

  return lines.join('\n')
}

function formatCompetitorsContext(result: CompetitorsResult, target: string): string {
  const items = result.items
  if (!items?.length) return ''

  const lines = [`## DataForSEO: Top Organic Competitors — ${target}`]
  lines.push('\n| Domain | Est. Monthly Traffic | Keywords | Avg SERP Position | Shared Keywords |')
  lines.push('|---|---|---|---|---|')

  for (const item of items.slice(0, 10)) {
    const organic = item.metrics?.organic
    lines.push(
      `| ${item.domain ?? '—'} | ${Math.round(organic?.etv ?? 0).toLocaleString()} | ${(organic?.count ?? 0).toLocaleString()} | ${item.avg_position?.toFixed(1) ?? '—'} | ${item.intersections ?? 0} |`
    )
  }

  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  const siteUrl = request.nextUrl.searchParams.get('siteUrl') ?? ''
  if (!siteUrl) return NextResponse.json({ rankContext: null, competitorsContext: null })

  let domain: string
  try {
    domain = new URL(siteUrl).hostname.replace(/^www\./, '')
  } catch {
    return NextResponse.json({ rankContext: null, competitorsContext: null })
  }

  const auth = getAuth()
  if (!auth) {
    return NextResponse.json({ rankContext: null, competitorsContext: null })
  }

  const params = { language_name: 'English', location_code: 2840 }

  const [rankResult, competitorsResult, keywordsResult] = await Promise.allSettled([
    callDataForSEO(auth, '/dataforseo_labs/google/domain_rank_overview/live', { target: domain, ...params }),
    callDataForSEO(auth, '/dataforseo_labs/google/competitors_domain/live', { target: domain, ...params, limit: 10, exclude_top_domains: true }),
    callDataForSEO(auth, '/dataforseo_labs/google/ranked_keywords/live', {
      target: domain,
      ...params,
      limit: 25,
      filters: [
        ['ranked_serp_element.serp_item.rank_group', '>=', 4],
        'and',
        ['ranked_serp_element.serp_item.rank_group', '<=', 20],
      ],
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
    }),
  ])

  const rankContext = rankResult.status === 'fulfilled' && rankResult.value
    ? formatRankContext(rankResult.value as DomainRankResult, domain)
    : null

  const competitorsContext = competitorsResult.status === 'fulfilled' && competitorsResult.value
    ? formatCompetitorsContext(competitorsResult.value as CompetitorsResult, domain)
    : null

  const keywordsContext = keywordsResult.status === 'fulfilled' && keywordsResult.value
    ? formatKeywordsContext(keywordsResult.value as RankedKeywordsResult, domain)
    : null

  return NextResponse.json({
    rankContext: rankContext || null,
    competitorsContext: competitorsContext || null,
    keywordsContext: keywordsContext || null,
  })
}
