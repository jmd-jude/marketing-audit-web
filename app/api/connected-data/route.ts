// Node.js runtime (NOT edge) — googleapis uses Node.js modules incompatible with Edge runtime
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { fetchGscData, fetchGa4Data, formatGscContext, formatGa4Context } from '@/lib/gsc-ga4'

const SESSION_COOKIE = 'goog_session'

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

interface SessionPayload {
  accessToken: string
  refreshToken: string
  expiryDate: number | null
  ga4PropertyId: string | null
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ gscContext: null, ga4Context: null })

  const secretKey = getSecretKey()
  if (!secretKey) return NextResponse.json({ gscContext: null, ga4Context: null })

  let session: SessionPayload
  try {
    const { payload } = await jwtVerify(token, secretKey)
    session = payload as unknown as SessionPayload
  } catch {
    return NextResponse.json({ gscContext: null, ga4Context: null })
  }

  const siteUrl = request.nextUrl.searchParams.get('siteUrl') ?? ''

  const [gscData, ga4Data] = await Promise.allSettled([
    fetchGscData(session.accessToken, session.refreshToken, siteUrl),
    session.ga4PropertyId
      ? fetchGa4Data(session.accessToken, session.refreshToken, session.ga4PropertyId)
      : Promise.resolve(null),
  ])

  const gscContext = gscData.status === 'fulfilled' && gscData.value ? formatGscContext(gscData.value) : null
  const ga4Context = ga4Data.status === 'fulfilled' && ga4Data.value ? formatGa4Context(ga4Data.value) : null

  return NextResponse.json({ gscContext, ga4Context })
}
