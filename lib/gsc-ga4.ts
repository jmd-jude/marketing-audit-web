import { google } from 'googleapis'
import type { analyticsadmin_v1alpha } from 'googleapis'

export interface GscData {
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ page: string; clicks: number }>
  indexSummary: { indexed: number; notIndexed: number; errors: number; warnings: number } | null
  clickTrend: { recent30: number; prior30: number; delta: number } | null
  impressionTrend: { recent30: number; prior30: number; delta: number } | null
}

export interface Ga4Data {
  sessionsByChannel: Array<{ channel: string; sessions: number }>
  topPages: Array<{ page: string; sessions: number; bounceRate: number; avgSessionDuration: number }> | null
  engagementRate: number | null
  bounceRate: number | null
  newVsReturning: { new: number; returning: number } | null
  conversionsByChannel: Array<{ channel: string; conversions: number; sessions: number; conversionRate: number }> | null
  sessionsByDevice: Array<{ device: string; sessions: number; engagementRate: number }> | null
  avgEngagementTime: number | null
  topEvents: Array<{ event: string; count: number }> | null
}

export interface ConnectedData {
  gsc: GscData | null
  ga4: Ga4Data | null
}

const NOISY_EVENTS = new Set(['session_start', 'first_visit', 'page_view'])

function getServiceAccountAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) return null
  try {
    const credentials = JSON.parse(keyJson)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
      ],
    })
  } catch {
    return null
  }
}

export async function discoverGa4PropertyId(domain: string): Promise<string | null> {
  try {
    const auth = getServiceAccountAuth()
    if (!auth) return null

    const admin = google.analyticsadmin({ version: 'v1alpha', auth })
    const res = await admin.accountSummaries.list({})
    const summaries = res.data.accountSummaries ?? []
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase()

    for (const account of summaries) {
      for (const prop of (account.propertySummaries ?? []) as analyticsadmin_v1alpha.Schema$GoogleAnalyticsAdminV1alphaPropertySummary[]) {
        const propName = prop.property ?? ''
        const displayName = (prop.displayName ?? '').toLowerCase().replace(/^www\./, '')
        if (displayName.includes(cleanDomain) || cleanDomain.includes(displayName)) {
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

export async function fetchGscData(siteUrl: string): Promise<GscData | null> {
  try {
    const auth = getServiceAccountAuth()
    if (!auth) return null

    const webmasters = google.webmasters({ version: 'v3', auth })

    const now = new Date()

    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const recent30End = now.toISOString().split('T')[0]
    const recent30Start = new Date(now)
    recent30Start.setDate(recent30Start.getDate() - 30)

    const prior30End = new Date(now)
    prior30End.setDate(prior30End.getDate() - 31)
    const prior30Start = new Date(now)
    prior30Start.setDate(prior30Start.getDate() - 61)

    const mainDateRange = {
      startDate: ninetyDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    }

    const [queriesRes, pagesRes, recentTrendRes, priorTrendRes, sitemapsRes] = await Promise.allSettled([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { ...mainDateRange, dimensions: ['query'], rowLimit: 50 },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { ...mainDateRange, dimensions: ['page'], rowLimit: 20 },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: recent30Start.toISOString().split('T')[0],
          endDate: recent30End,
        },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: prior30Start.toISOString().split('T')[0],
          endDate: prior30End.toISOString().split('T')[0],
        },
      }),
      webmasters.sitemaps.list({ siteUrl }),
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

    // Index coverage from sitemaps
    let indexSummary: GscData['indexSummary'] = null
    if (sitemapsRes.status === 'fulfilled') {
      const sitemaps = sitemapsRes.value.data.sitemap ?? []
      let totalIndexed = 0
      let totalSubmitted = 0
      for (const sitemap of sitemaps) {
        for (const content of (sitemap.contents ?? [])) {
          totalSubmitted += parseInt((content.submitted as string | undefined) ?? '0', 10)
          totalIndexed += parseInt((content.indexed as string | undefined) ?? '0', 10)
        }
      }
      if (totalSubmitted > 0) {
        indexSummary = {
          indexed: totalIndexed,
          notIndexed: Math.max(0, totalSubmitted - totalIndexed),
          errors: 0,
          warnings: 0,
        }
      }
    }

    // Click and impression trend
    let clickTrend: GscData['clickTrend'] = null
    let impressionTrend: GscData['impressionTrend'] = null

    if (recentTrendRes.status === 'fulfilled' && priorTrendRes.status === 'fulfilled') {
      const recentRows = recentTrendRes.value.data.rows ?? []
      const priorRows = priorTrendRes.value.data.rows ?? []

      const recentClicks = recentRows.reduce((sum, r) => sum + (r.clicks ?? 0), 0)
      const priorClicks = priorRows.reduce((sum, r) => sum + (r.clicks ?? 0), 0)
      const recentImpressions = recentRows.reduce((sum, r) => sum + (r.impressions ?? 0), 0)
      const priorImpressions = priorRows.reduce((sum, r) => sum + (r.impressions ?? 0), 0)

      clickTrend = {
        recent30: Math.round(recentClicks),
        prior30: Math.round(priorClicks),
        delta: priorClicks > 0 ? Math.round(((recentClicks - priorClicks) / priorClicks) * 1000) / 10 : 0,
      }
      impressionTrend = {
        recent30: Math.round(recentImpressions),
        prior30: Math.round(priorImpressions),
        delta: priorImpressions > 0 ? Math.round(((recentImpressions - priorImpressions) / priorImpressions) * 1000) / 10 : 0,
      }
    }

    return { topQueries, topPages, indexSummary, clickTrend, impressionTrend }
  } catch {
    return null
  }
}

export async function fetchGa4Data(propertyId: string): Promise<Ga4Data | null> {
  try {
    const auth = getServiceAccountAuth()
    if (!auth) return null

    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const endDate = 'today'
    const startDate = '90daysAgo'

    const [channelRes, pagesRes, newReturnRes, conversionsByChannelRes, deviceRes, engagementTimeRes, eventsRes] = await Promise.allSettled([
      // Sessions by channel
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
      }),
      // Top landing pages with engagement quality
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'landingPage' }],
          metrics: [{ name: 'sessions' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '10',
        },
      }),
      // New vs returning
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'newVsReturning' }],
          metrics: [{ name: 'sessions' }, { name: 'engagementRate' }, { name: 'bounceRate' }],
        },
      }),
      // Conversions by channel
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
          metrics: [{ name: 'conversions' }, { name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
          limit: '10',
        },
      }),
      // Device category breakdown
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }, { name: 'engagementRate' }],
        },
      }),
      // Site-wide avg engagement time
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: 'averageSessionDuration' }, { name: 'userEngagementDuration' }],
        },
      }),
      // Top events
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: '15',
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
          bounceRate: Math.round(parseFloat(r.metricValues?.[1]?.value ?? '0') * 1000) / 10,
          avgSessionDuration: Math.round(parseFloat(r.metricValues?.[2]?.value ?? '0')),
        }))
      : null

    let engagementRate: number | null = null
    let bounceRate: number | null = null
    let newVsReturning: Ga4Data['newVsReturning'] = null

    if (newReturnRes.status === 'fulfilled') {
      const rows = newReturnRes.value.data.rows ?? []
      let newSessions = 0
      let returningSessions = 0
      let totalEngagement = 0
      let totalBounce = 0
      let totalSessions = 0

      for (const row of rows) {
        const dim = row.dimensionValues?.[0]?.value ?? ''
        const sessions = parseInt(row.metricValues?.[0]?.value ?? '0', 10)
        const eng = parseFloat(row.metricValues?.[1]?.value ?? '0')
        const bounce = parseFloat(row.metricValues?.[2]?.value ?? '0')
        if (dim === 'new') newSessions = sessions
        if (dim === 'returning') returningSessions = sessions
        totalEngagement += eng * sessions
        totalBounce += bounce * sessions
        totalSessions += sessions
      }

      if (totalSessions > 0) {
        engagementRate = Math.round((totalEngagement / totalSessions) * 1000) / 10
        bounceRate = Math.round((totalBounce / totalSessions) * 1000) / 10
      }
      if (newSessions + returningSessions > 0) {
        newVsReturning = { new: newSessions, returning: returningSessions }
      }
    }

    const conversionsByChannel: Ga4Data['conversionsByChannel'] = conversionsByChannelRes.status === 'fulfilled'
      ? (conversionsByChannelRes.value.data.rows ?? [])
          .map((r) => {
            const conversions = parseFloat(r.metricValues?.[0]?.value ?? '0')
            const sessions = parseInt(r.metricValues?.[1]?.value ?? '0', 10)
            return {
              channel: r.dimensionValues?.[0]?.value ?? 'Unknown',
              conversions: Math.round(conversions),
              sessions,
              conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
            }
          })
          .filter((r) => r.conversions > 0)
      : null

    const sessionsByDevice: Ga4Data['sessionsByDevice'] = deviceRes.status === 'fulfilled'
      ? (deviceRes.value.data.rows ?? []).map((r) => ({
          device: r.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: parseInt(r.metricValues?.[0]?.value ?? '0', 10),
          engagementRate: Math.round(parseFloat(r.metricValues?.[1]?.value ?? '0') * 1000) / 10,
        }))
      : null

    let avgEngagementTime: number | null = null
    if (engagementTimeRes.status === 'fulfilled') {
      const rows = engagementTimeRes.value.data.rows ?? []
      const val = rows[0]?.metricValues?.[0]?.value
      if (val != null) avgEngagementTime = Math.round(parseFloat(val))
    }

    const topEvents: Ga4Data['topEvents'] = eventsRes.status === 'fulfilled'
      ? (eventsRes.value.data.rows ?? [])
          .map((r) => ({
            event: r.dimensionValues?.[0]?.value ?? '',
            count: parseInt(r.metricValues?.[0]?.value ?? '0', 10),
          }))
          .filter((e) => !NOISY_EVENTS.has(e.event))
      : null

    return {
      sessionsByChannel,
      topPages,
      engagementRate,
      bounceRate,
      newVsReturning,
      conversionsByChannel,
      sessionsByDevice,
      avgEngagementTime,
      topEvents,
    }
  } catch {
    return null
  }
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} min`
  return `${seconds}s`
}

export function formatGscContext(gsc: GscData): string {
  const lines = ['## Google Search Console Data (Last 90 Days)']

  if (gsc.indexSummary) {
    const { indexed, notIndexed } = gsc.indexSummary
    lines.push(`\n**Index Coverage:** ${indexed.toLocaleString()} pages indexed, ${notIndexed.toLocaleString()} excluded`)
  }

  if (gsc.clickTrend) {
    const dir = gsc.clickTrend.delta >= 0 ? '+' : ''
    lines.push(`**Click Trend (30-day vs. prior 30):** ${dir}${gsc.clickTrend.delta}% (${gsc.clickTrend.recent30.toLocaleString()} clicks vs ${gsc.clickTrend.prior30.toLocaleString()})`)
  }

  if (gsc.impressionTrend) {
    const dir = gsc.impressionTrend.delta >= 0 ? '+' : ''
    lines.push(`**Impression Trend (30-day vs. prior 30):** ${dir}${gsc.impressionTrend.delta}% (${gsc.impressionTrend.recent30.toLocaleString()} vs ${gsc.impressionTrend.prior30.toLocaleString()})`)
  }

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

  if (ga4.avgEngagementTime !== null) {
    lines.push(`\n**Avg Session Duration (site-wide):** ${formatDuration(ga4.avgEngagementTime)}`)
  }

  if (ga4.engagementRate !== null) lines.push(`**Engagement Rate:** ${ga4.engagementRate}%`)
  if (ga4.bounceRate !== null) lines.push(`**Bounce Rate:** ${ga4.bounceRate}%`)

  if (ga4.newVsReturning) {
    const total = ga4.newVsReturning.new + ga4.newVsReturning.returning
    const newPct = total > 0 ? Math.round((ga4.newVsReturning.new / total) * 100) : 0
    lines.push(`**New vs Returning:** ${newPct}% new, ${100 - newPct}% returning`)
  }

  if (ga4.sessionsByDevice && ga4.sessionsByDevice.length > 0) {
    lines.push('\n### Sessions by Device')
    lines.push('| Device | Sessions | Engagement Rate |')
    lines.push('|---|---|---|')
    ga4.sessionsByDevice.forEach((d) => {
      lines.push(`| ${d.device} | ${d.sessions.toLocaleString()} | ${d.engagementRate}% |`)
    })
  }

  if (ga4.sessionsByChannel.length > 0) {
    lines.push('\n### Sessions by Channel')
    lines.push('| Channel | Sessions |')
    lines.push('|---|---|')
    ga4.sessionsByChannel.forEach((c) => lines.push(`| ${c.channel} | ${c.sessions.toLocaleString()} |`))
  }

  if (ga4.conversionsByChannel && ga4.conversionsByChannel.length > 0) {
    lines.push('\n### Conversions by Channel')
    lines.push('| Channel | Sessions | Conversions | CVR% |')
    lines.push('|---|---|---|---|')
    ga4.conversionsByChannel.forEach((c) => {
      lines.push(`| ${c.channel} | ${c.sessions.toLocaleString()} | ${c.conversions.toLocaleString()} | ${c.conversionRate}% |`)
    })
  } else if (ga4.conversionsByChannel !== null) {
    lines.push('\n**Conversions:** No conversion events recorded — conversion tracking may not be configured.')
  }

  if (ga4.topPages && ga4.topPages.length > 0) {
    lines.push('\n### Top Landing Pages')
    lines.push('| Page | Sessions | Bounce Rate | Avg Duration |')
    lines.push('|---|---|---|---|')
    ga4.topPages.forEach((p) => {
      lines.push(`| ${p.page} | ${p.sessions.toLocaleString()} | ${p.bounceRate}% | ${formatDuration(p.avgSessionDuration)} |`)
    })
  }

  if (ga4.topEvents && ga4.topEvents.length > 0) {
    lines.push('\n### Top Events (custom)')
    lines.push('| Event | Count |')
    lines.push('|---|---|')
    ga4.topEvents.forEach((e) => lines.push(`| ${e.event} | ${e.count.toLocaleString()} |`))
  } else if (ga4.topEvents !== null) {
    lines.push('\n**Events:** No custom conversion events detected — analytics tracking may be incomplete.')
  }

  return lines.join('\n')
}
