import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'goog_session'

export async function POST() {
  const response = NextResponse.json({ disconnected: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
