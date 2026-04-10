import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'goog_session'

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    return Response.json({ connected: false })
  }

  try {
    await jwtVerify(token, getSecretKey())
    return Response.json({ connected: true })
  } catch {
    return Response.json({ connected: false })
  }
}
