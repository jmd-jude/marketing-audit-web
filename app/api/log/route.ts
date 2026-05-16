import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

// Node runtime — can write files. Edge audit route POSTs here fire-and-forget.
export const runtime = 'nodejs'

const LOG_DIR = join(process.cwd(), 'logs')

async function ensureDir() {
  await mkdir(LOG_DIR, { recursive: true })
}

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

export async function POST(request: Request) {
  const body = await request.json() as {
    type?: 'init' | 'agent' | 'complete'
    text?: string
    data?: Record<string, unknown>
  }

  const type = body.type ?? 'complete'

  // ── init — INSERT empty row at audit start ──────────────────────
  if (type === 'init' && process.env.DATABASE_URL) {
    try {
      const sql = getDb()
      const d = body.data as { id: string; timestamp: string; url: string; auditor: string }
      await sql`
        INSERT INTO audits (id, timestamp, url, auditor, connected, payload)
        VALUES (
          ${d.id},
          ${d.timestamp},
          ${d.url},
          ${d.auditor ?? null},
          false,
          '{}'::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `
    } catch (err) {
      console.error('[log route] init insert failed:', err)
    }
    return new Response(null, { status: 204 })
  }

  // ── agent — PATCH single agent result into payload ──────────────
  if (type === 'agent' && process.env.DATABASE_URL) {
    try {
      const sql = getDb()
      const d = body.data as { id: string; key: string; result: Record<string, unknown> }
      const patch = JSON.stringify({ [d.key]: d.result })
      await sql`
        UPDATE audits
        SET payload = payload || ${patch}::jsonb
        WHERE id = ${d.id}
      `
    } catch (err) {
      console.error('[log route] agent patch failed:', err)
    }
    return new Response(null, { status: 204 })
  }

  // ── complete — full write (unchanged behavior) ─────────────────
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

  if (body.data && process.env.DATABASE_URL) {
    try {
      const sql = getDb()
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
        ON CONFLICT (id) DO UPDATE SET
          composite_score = EXCLUDED.composite_score,
          connected       = EXCLUDED.connected,
          model           = EXCLUDED.model,
          duration_ms     = EXCLUDED.duration_ms,
          payload         = EXCLUDED.payload
      `
    } catch (err) {
      console.error('[log route] postgres write failed:', err)
    }
  }

  // Fire Discord completion notification from Node runtime so it can be properly awaited.
  // The Edge audit route can't reliably fire outbound requests after closing its stream.
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (webhookUrl && body.data) {
    try {
      const d = body.data as Record<string, unknown>
      const agents = (d.agents as Array<{ key: string; score: number; inputTokens: number; outputTokens: number }>) ?? []
      const totalIn = agents.reduce((s, a) => s + (a.inputTokens ?? 0), 0)
      const totalOut = agents.reduce((s, a) => s + (a.outputTokens ?? 0), 0)
      const origin = new URL(request.url).origin
      const reportUrl = `${origin}/audit/${d.id as string}`
      const scoreBar = (s: number) => '█'.repeat(Math.round(s / 10)) + '░'.repeat(10 - Math.round(s / 10))
      const agentLines = agents
        .map((a) => `\`${scoreBar(a.score)}\` **${a.score}** — ${a.key}`)
        .join('\n')
      const cost = ((totalIn * 3 + totalOut * 15) / 1_000_000).toFixed(4)
      const duration = (((d.durationMs as number) ?? 0) / 1000).toFixed(1)
      const compositeScore = d.compositeScore as number
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: 'Audit Complete',
            url: d.url as string,
            color: compositeScore >= 75 ? 0x16a34a : compositeScore >= 55 ? 0xca8a04 : 0xdc2626,
            fields: [
              { name: 'Auditor', value: (d.auditor as string) || 'Unknown', inline: true },
              { name: 'Overall Score', value: `**${compositeScore}/100**`, inline: true },
              { name: 'Duration', value: `${duration}s`, inline: true },
              { name: 'Agent Scores', value: agentLines || 'n/a', inline: false },
              { name: 'Token Usage', value: `↑ ${totalIn.toLocaleString()} in  ↓ ${totalOut.toLocaleString()} out`, inline: false },
              { name: 'Cost', value: `$${cost}`, inline: true },
              { name: 'Model', value: (d.model as string) || 'unknown', inline: true },
              { name: 'Report', value: reportUrl, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      })
    } catch (err) {
      console.error('[log route] discord notify failed:', err)
    }
  }

  return new Response(null, { status: 204 })
}
