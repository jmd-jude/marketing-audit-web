import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Node runtime — can write files. Edge audit route POSTs here fire-and-forget.
export const runtime = 'nodejs'

const LOG_DIR = join(process.cwd(), 'logs')

async function ensureDir() {
  await mkdir(LOG_DIR, { recursive: true })
}

export async function POST(request: Request) {
  const body = await request.json() as { text?: string; data?: Record<string, unknown> }

  // File writes — best-effort only, Vercel's filesystem is read-only so these will fail in prod
  try {
    await ensureDir()
    if (body.text) {
      await appendFile(join(LOG_DIR, 'audit.log'), body.text + '\n', 'utf8')
    }
    if (body.data) {
      await appendFile(
        join(LOG_DIR, 'audit-data.jsonl'),
        JSON.stringify(body.data) + '\n',
        'utf8'
      )
    }
  } catch {
    // Expected to fail on Vercel — read-only filesystem
  }

  // Postgres — separate try/catch so file failures don't block DB writes
  if (body.data && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL)
      const d = body.data as Record<string, unknown>
      await sql`
        INSERT INTO audits (id, timestamp, url, auditor, composite_score, connected, model, duration_ms, payload)
        VALUES (
          ${d.id as string},
          ${d.timestamp as string},
          ${d.url as string},
          ${d.auditor as string ?? null},
          ${d.compositeScore as number ?? null},
          ${d.connected as boolean ?? false},
          ${d.model as string ?? null},
          ${d.durationMs as number ?? null},
          ${JSON.stringify(d)}
        )
        ON CONFLICT (id) DO NOTHING
      `
    } catch (err) {
      console.error('[log route] postgres write failed:', err)
    }
  }

  return new Response(null, { status: 204 })
}
