// Node.js runtime (NOT edge) — googleapis uses Node.js modules incompatible with Edge runtime
import { NextRequest, NextResponse } from 'next/server'
import { fetchGscData, fetchGa4Data, formatGscContext, formatGa4Context, discoverGa4PropertyId } from '@/lib/gsc-ga4'

export async function GET(request: NextRequest) {
  const siteUrl = request.nextUrl.searchParams.get('siteUrl') ?? ''
  if (!siteUrl) return NextResponse.json({ gscContext: null, ga4Context: null })

  let domain: string
  try {
    domain = new URL(siteUrl).hostname
  } catch {
    return NextResponse.json({ gscContext: null, ga4Context: null })
  }

  // Discover GA4 property matching this domain, then fetch both in parallel
  const ga4PropertyId = await discoverGa4PropertyId(domain)

  const [gscData, ga4Data] = await Promise.allSettled([
    fetchGscData(siteUrl),
    ga4PropertyId ? fetchGa4Data(ga4PropertyId) : Promise.resolve(null),
  ])

  const gscContext = gscData.status === 'fulfilled' && gscData.value ? formatGscContext(gscData.value) : null
  const ga4Context = ga4Data.status === 'fulfilled' && ga4Data.value ? formatGa4Context(ga4Data.value) : null

  return NextResponse.json({ gscContext, ga4Context })
}
