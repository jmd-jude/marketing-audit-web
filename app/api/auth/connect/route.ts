import { getAuthUrl } from '@/lib/gsc-ga4'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex')
  const url = getAuthUrl(state)

  const response = NextResponse.redirect(url, 302)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
