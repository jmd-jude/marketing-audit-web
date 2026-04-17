/**
 * DataForSEO sandbox validation script.
 * Hits the two Labs endpoints against a real domain using the sandbox environment.
 * No credits consumed — sandbox returns synthetic but structurally accurate responses.
 *
 * Run with: npx tsx scripts/test-dataforseo.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually — no dotenv dependency needed
const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const LOGIN = process.env.DATAFORSEO_LOGIN
const PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!LOGIN || !PASSWORD) {
  console.error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD in .env.local')
  process.exit(1)
}

const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')
const SANDBOX_BASE = 'https://sandbox.dataforseo.com/v3'
const TARGET = 'cohereone.com'

async function callEndpoint(path: string, body: object): Promise<unknown> {
  const res = await fetch(`${SANDBOX_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([body]),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  console.log(`\nDataForSEO sandbox test — target: ${TARGET}\n`)

  // 1. Domain Rank Overview
  console.log('── 1. domain_rank_overview/live ──────────────────────────')
  try {
    const rankData = await callEndpoint(
      '/dataforseo_labs/google/domain_rank_overview/live',
      { target: TARGET, language_name: 'English', location_code: 2840 }
    )
    const result = (rankData as { tasks?: Array<{ result?: unknown[] }> }).tasks?.[0]?.result?.[0]
    console.log('Full response structure:')
    console.log(JSON.stringify(rankData, null, 2).slice(0, 3000))
    if (result) {
      const r = result as Record<string, unknown>
      const metrics = r.metrics as { organic?: Record<string, unknown>; paid?: Record<string, unknown> } | undefined
      console.log('\nKey fields extracted:')
      console.log('  metrics.organic.etv:', metrics?.organic?.etv)
      console.log('  metrics.organic.count:', metrics?.organic?.count)
      console.log('  metrics.organic.pos_1:', metrics?.organic?.pos_1)
      console.log('  metrics.organic.pos_2_3:', metrics?.organic?.pos_2_3)
      console.log('  metrics.organic.pos_4_10:', metrics?.organic?.pos_4_10)
      console.log('  metrics.organic.is_up:', metrics?.organic?.is_up)
      console.log('  metrics.organic.is_down:', metrics?.organic?.is_down)
      console.log('  metrics.paid.count:', metrics?.paid?.count)
      console.log('  estimated_paid_traffic_cost:', r.estimated_paid_traffic_cost)
    }
  } catch (err) {
    console.error('domain_rank_overview failed:', err)
  }

  // 2. Competitors Domain
  console.log('\n── 2. competitors_domain/live ────────────────────────────')
  try {
    const compData = await callEndpoint(
      '/dataforseo_labs/google/competitors_domain/live',
      { target: TARGET, language_name: 'English', location_code: 2840, limit: 10, exclude_top_domains: true }
    )
    console.log('Full response structure:')
    console.log(JSON.stringify(compData, null, 2).slice(0, 3000))
    const items = (compData as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> }).tasks?.[0]?.result?.[0]?.items
    if (items?.length) {
      console.log(`\n${items.length} competitors returned. First item:`)
      console.log(JSON.stringify(items[0], null, 2))
      console.log('\nKey fields per competitor:')
      for (const item of (items as Array<Record<string, unknown>>).slice(0, 3)) {
        const metrics = item.metrics as { organic?: Record<string, unknown> } | undefined
        console.log(`  domain: ${item.domain}  etv: ${metrics?.organic?.etv}  count: ${metrics?.organic?.count}  avg_position: ${item.avg_position}  intersections: ${item.intersections}`)
      }
    }
  } catch (err) {
    console.error('competitors_domain failed:', err)
  }

  console.log('\n── Done ──────────────────────────────────────────────────\n')
}

main().catch(console.error)
