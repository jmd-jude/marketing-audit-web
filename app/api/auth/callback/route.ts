import { exchangeCodeForTokens, discoverGa4PropertyId } from '@/lib/gsc-ga4'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const SESSION_COOKIE = 'goog_session'
const SESSION_MAX_AGE = 60 * 60 * 24 // 24 hours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`)
  }

  // Validate CSRF state
  const storedState = request.cookies.get('oauth_state')?.value
  if (!storedState || storedState !== returnedState) {
    return NextResponse.redirect(`${origin}/?auth_error=state_mismatch`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const accessToken = tokens.access_token ?? ''
    const refreshToken = tokens.refresh_token ?? ''

    // Best-effort: discover GA4 property ID at connect time so audit route doesn't need to
    const ga4PropertyId = await discoverGa4PropertyId(accessToken, refreshToken, origin)

    const sessionPayload = {
      accessToken,
      refreshToken,
      expiryDate: tokens.expiry_date ?? null,
      ga4PropertyId,
    }

    const jwt = await new SignJWT(sessionPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getSecretKey())

    const response = NextResponse.redirect(`${origin}/?connected=1`)
    response.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    response.cookies.delete('oauth_state')
    return response
  } catch {
    return NextResponse.redirect(`${origin}/?auth_error=token_exchange_failed`)
  }
}
