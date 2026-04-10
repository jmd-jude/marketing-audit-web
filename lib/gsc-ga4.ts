import { google } from 'googleapis'
import type { analyticsadmin_v1alpha } from 'googleapis'

export interface GscData {
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ page: string; clicks: number }>
  indexSummary: { indexed: number; notIndexed: number; errors: number } | null
}

export interface Ga4Data {
  sessionsByChannel: Array<{ channel: string; sessions: number }>
  topPages: Array<{ page: string; sessions: number }>
  engagementRate: number | null
  bounceRate: number | null
  newVsReturning: { new: number; returning: number } | null
}

export interface ConnectedData {
  gsc: GscData | null
  ga4: Ga4Data | null
}

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export function getAuthUrl(state: string): string {
  const oauth2Client = makeOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
    state,
    prompt: 'consent',
  })
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = makeOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// After OAuth, discover the GA4 property ID matching a domain (stored in session at callback time)
export async function discoverGa4PropertyId(accessToken: string, refreshToken: string, domain: string): Promise<string | null> {
  try {
    const oauth2Client = makeOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
    const admin = google.analyticsadmin({ version: 'v1alpha', auth: oauth2Client })
    const res = await admin.accountSummaries.list({})
    const summaries = res.data.accountSummaries ?? []
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

    for (const account of summaries) {
      for (const prop of (account.propertySummaries ?? []) as analyticsadmin_v1alpha.Schema$GoogleAnalyticsAdminV1alphaPropertySummary[]) {
        const propName = prop.property ?? ''
        // Check display name or data streams for domain match
        const displayName = (prop.displayName ?? '').toLowerCase()
        if (displayName.includes(cleanDomain) || cleanDomain.includes(displayName)) {
          // property name is like "properties/123456" — extract the ID
          const id = propName.replace('properties/', '')
          if (id) return id
        }
      }
    }

    // Fallback: return first available property if only one
    const firstProp = summaries[0]?.propertySummaries?.[0] as analyticsadmin_v1alpha.Schema$GoogleAnalyticsAdminV1alphaPropertySummary | undefined
    const firstId = firstProp?.property?.replace('properties/', '')
    return firstId ?? null
  } catch {
    return null
  }
}

export async function fetchGscData(accessToken: string, refreshToken: string, siteUrl: string): Promise<GscData | null> {
  try {
    const oauth2Client = makeOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

    const webmasters = google.webmasters({ version: 'v3', auth: oauth2Client })
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)
    const dateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }

    const [queriesRes, pagesRes] = await Promise.allSettled([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { ...dateRange, dimensions: ['query'], rowLimit: 50 },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { ...dateRange, dimensions: ['page'], rowLimit: 20 },
      }),
    ])

    const topQueries = queriesRes.status === 'fulfilled'
      ? (queriesRes.value.data.rows ?? []).map((r) => ({
          query: r.keys?.[0] ?? '',
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
          ctr: Math.round((r.ctr ?? 0) * 1000) / 10,
          position: Math.round((r.position ?? 0) * 10) / 10,
        }))
      : []

    const topPages = pagesRes.status === 'fulfilled'
      ? (pagesRes.value.data.rows ?? []).map((r) => ({
          page: r.keys?.[0] ?? '',
          clicks: r.clicks ?? 0,
        }))
      : []

    return { topQueries, topPages, indexSummary: null }
  } catch {
    return null
  }
}

export async function fetchGa4Data(accessToken: string, refreshToken: string, propertyId: string): Promise<Ga4Data | null> {
  try {
    const oauth2Client = makeOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: oauth2Client })
    const endDate = 'today'
    const startDate = '90daysAgo'

    const [channelRes, pagesRes, newReturnRes] = await Promise.allSettled([
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '10',
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'newVsReturning' }],
          metrics: [{ name: 'sessions' }, { name: 'engagementRate' }, { name: 'bounceRate' }],
        },
      }),
    ])

    const sessionsByChannel = channelRes.status === 'fulfilled'
      ? (channelRes.value.data.rows ?? []).map((r) => ({
          channel: r.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: parseInt(r.metricValues?.[0]?.value ?? '0', 10),
        }))
      : []

    const topPages = pagesRes.status === 'fulfilled'
      ? (pagesRes.value.data.rows ?? []).map((r) => ({
          page: r.dimensionValues?.[0]?.value ?? '',
          sessions: parseInt(r.metricValues?.[0]?.value ?? '0', 10),
        }))
      : []

    let engagementRate: number | null = null
    let bounceRate: number | null = null
    let newVsReturning: Ga4Data['newVsReturning'] = null

    if (newReturnRes.status === 'fulfilled') {
      const rows = newReturnRes.value.data.rows ?? []
      let newSessions = 0
      let returningSessions = 0
      let totalEngagement = 0
      let totalBounce = 0
      let count = 0

      for (const row of rows) {
        const dim = row.dimensionValues?.[0]?.value ?? ''
        const sessions = parseInt(row.metricValues?.[0]?.value ?? '0', 10)
        const eng = parseFloat(row.metricValues?.[1]?.value ?? '0')
        const bounce = parseFloat(row.metricValues?.[2]?.value ?? '0')
        if (dim === 'new') newSessions = sessions
        if (dim === 'returning') returningSessions = sessions
        totalEngagement += eng
        totalBounce += bounce
        count++
      }

      if (count > 0) {
        engagementRate = Math.round((totalEngagement / count) * 1000) / 10
        bounceRate = Math.round((totalBounce / count) * 1000) / 10
      }
      if (newSessions + returningSessions > 0) {
        newVsReturning = { new: newSessions, returning: returningSessions }
      }
    }

    return { sessionsByChannel, topPages, engagementRate, bounceRate, newVsReturning }
  } catch {
    return null
  }
}

export function formatGscContext(gsc: GscData): string {
  const lines = ['## Google Search Console Data (Last 90 Days)']

  if (gsc.topQueries.length > 0) {
    lines.push('\n### Top Queries by Impressions')
    lines.push('| Query | Clicks | Impressions | CTR | Avg Position |')
    lines.push('|---|---|---|---|---|')
    gsc.topQueries.slice(0, 20).forEach((q) => {
      lines.push(`| ${q.query} | ${q.clicks} | ${q.impressions} | ${q.ctr}% | ${q.position} |`)
    })
  }

  if (gsc.topPages.length > 0) {
    lines.push('\n### Top Landing Pages by Clicks')
    lines.push('| Page | Clicks |')
    lines.push('|---|---|')
    gsc.topPages.forEach((p) => lines.push(`| ${p.page} | ${p.clicks} |`))
  }

  return lines.join('\n')
}

export function formatGa4Context(ga4: Ga4Data): string {
  const lines = ['## Google Analytics 4 Data (Last 90 Days)']

  if (ga4.sessionsByChannel.length > 0) {
    lines.push('\n### Sessions by Channel')
    lines.push('| Channel | Sessions |')
    lines.push('|---|---|')
    ga4.sessionsByChannel.forEach((c) => lines.push(`| ${c.channel} | ${c.sessions.toLocaleString()} |`))
  }

  if (ga4.topPages.length > 0) {
    lines.push('\n### Top Pages by Sessions')
    lines.push('| Page | Sessions |')
    lines.push('|---|---|')
    ga4.topPages.forEach((p) => lines.push(`| ${p.page} | ${p.sessions.toLocaleString()} |`))
  }

  if (ga4.engagementRate !== null) lines.push(`\n**Engagement Rate:** ${ga4.engagementRate}%`)
  if (ga4.bounceRate !== null) lines.push(`**Bounce Rate:** ${ga4.bounceRate}%`)
  if (ga4.newVsReturning) {
    const total = ga4.newVsReturning.new + ga4.newVsReturning.returning
    const newPct = total > 0 ? Math.round((ga4.newVsReturning.new / total) * 100) : 0
    lines.push(`**New vs Returning:** ${newPct}% new, ${100 - newPct}% returning`)
  }

  return lines.join('\n')
}
