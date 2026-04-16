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
  try {
    const body = await request.json() as { text?: string; data?: Record<string, unknown> }

    await ensureDir()

    // Human-readable log
    if (body.text) {
      await appendFile(join(LOG_DIR, 'audit.log'), body.text + '\n', 'utf8')
    }

    // Structured JSONL for data analysis
    if (body.data) {
      await appendFile(
        join(LOG_DIR, 'audit-data.jsonl'),
        JSON.stringify(body.data) + '\n',
        'utf8'
      )

      // Persist to Postgres
      if (process.env.DATABASE_URL) {
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
      }
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    // Non-critical — never fail the audit over a log write
    console.error('[log route] write failed:', err)
    return new Response(null, { status: 204 })
  }
}
