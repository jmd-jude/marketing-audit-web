import { neon } from '@neondatabase/serverless'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Gate with ADMIN_KEY env var — check Bearer token or ?key= param
  const adminKey = process.env.ADMIN_KEY
  if (adminKey) {
    const auth = request.headers.get('authorization')
    const bearerMatch = auth?.match(/^Bearer (.+)$/)
    const paramKey = new URL(request.url).searchParams.get('key')
    if (bearerMatch?.[1] !== adminKey && paramKey !== adminKey) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  if (!process.env.DATABASE_URL) {
    return new Response('DATABASE_URL not configured', { status: 503 })
  }

  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`
      SELECT payload
      FROM audits
      ORDER BY timestamp DESC
      LIMIT 500
    `
    const payloads = rows.map(r => r.payload)
    return Response.json(payloads)
  } catch (err) {
    console.error('[admin/audits] query failed:', err)
    return new Response('Query failed', { status: 500 })
  }
}
