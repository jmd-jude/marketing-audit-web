import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'OAuth flow removed — using service account auth' }, { status: 410 })
}
