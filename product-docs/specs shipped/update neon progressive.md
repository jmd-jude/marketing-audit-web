# 
**`app/api/log/route.ts` — full replacement**

```typescript
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

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

  // ── NEW: init — INSERT empty row at audit start ──────────────────────
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

  // ── NEW: agent — PATCH single agent result into payload ──────────────
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

  // ── EXISTING: complete — full write (unchanged behavior) ─────────────
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

  return new Response(null, { status: 204 })
}
```

Two things worth noting in the `complete` handler: I changed `ON CONFLICT DO NOTHING` to `DO UPDATE SET` — because now the row already exists from the `init` write, the original `DO NOTHING` would silently skip the final full write. The upsert ensures the complete payload always wins. And I extracted `getDb()` as a function so each handler gets a fresh connection rather than sharing one across the module.

---

**`app/api/audit/route.ts` — three surgical changes only**

Change 1: move `auditId` to the top of `start()`, right before `notifyDiscordStart`:

```typescript
// BEFORE (near bottom of start()):
const auditId = crypto.randomUUID()

// AFTER (move to top of start(), before notifyDiscordStart):
const auditId = crypto.randomUUID()
const auditor = company ? `${name} @ ${company}` : name

notifyDiscordStart({ name, company, url: targetUrl }).catch(() => {})
```

Change 2: after the `send({ type: 'fetched', ... })` call, add the init write:

```typescript
send({ type: 'fetched', ... }) // existing, unchanged

// ADD after:
fetch(`${origin}/api/log`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'init',
    data: { id: auditId, timestamp: new Date().toISOString(), url: targetUrl, auditor },
  }),
}).catch(() => {})
```

Change 3: inside `promises.map()`, after the `send({ type: 'agent_complete', ... })` call:

```typescript
send({ type: 'agent_complete', key, result: agentResult.result, usage: agentResult.usage })

// ADD after:
fetch(`${origin}/api/log`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'agent',
    data: { id: auditId, key, result: agentResult.result },
  }),
}).catch(() => {})

return agentResult
```

Apply the same pattern in the `catch` block's fallback for failed agents — same shape, `result: fallback.result`.

Also remove the `const auditor = ...` line near the bottom of `start()` since it moved up.

---

**That's the entire Level 1 refactor.** The `complete` write and Discord notification at the bottom are completely untouched. The SSE stream is completely untouched. The two-stage reveal is completely untouched. You get progressive persistence, a reliable `/audit/[id]` page that works mid-audit, and the foundation for DataForSEO writes to slot in via the same `agent` patch pattern when you're ready.