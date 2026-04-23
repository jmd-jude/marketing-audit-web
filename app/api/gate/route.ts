import { neon } from '@neondatabase/serverless'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { email, auditId, url, auditor } = await request.json() as {
    email: string
    auditId: string
    url: string
    auditor?: string
  }

  if (email && auditId && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL)
      await sql`UPDATE audits SET email = ${email} WHERE id = ${auditId}`
    } catch (err) {
      console.error('[gate] email persist failed:', err)
    }
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (webhookUrl) {
    const label = auditor ? `**${auditor}**` : 'Unknown'
    const message = {
      embeds: [{
        title: 'Full Report Requested',
        color: 0x2D4A6E,
        fields: [
          { name: 'Email', value: email, inline: false },
          { name: 'Prospect', value: label, inline: true },
          { name: 'Site', value: url, inline: true },
          { name: 'Report', value: `https://digital-audit.graphent.app/audit/${auditId}?full=1`, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    }
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }).catch(() => { /* non-critical */ })
  }

  return new Response(null, { status: 204 })
}
