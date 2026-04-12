import { NextResponse } from 'next/server'

// Service account auth is always-on — no session to check
export async function GET() {
  return NextResponse.json({ connected: true })
}
