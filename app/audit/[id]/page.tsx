import { neon } from '@neondatabase/serverless'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AuditReport from './AuditReport'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function auditMeta(data: Record<string, any>): Metadata {
  const raw = data.url ?? ''
  const hostname = (() => {
    try { return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '') }
    catch { return raw }
  })()
  const score: number | undefined = data.compositeScore
  const verdict: string | undefined = data.summary?.overall_verdict

  const title = score != null
    ? `Marketing Audit — ${hostname} (${score}/100)`
    : `Marketing Audit — ${hostname}`
  const description = verdict ?? `Five-dimension digital marketing analysis for ${hostname}. Content, conversion, SEO, competitive positioning, and brand strategy.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT payload FROM audits WHERE id = ${id} LIMIT 1`
  if (!rows.length) return { title: 'Marketing Audit' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return auditMeta(rows[0].payload as Record<string, any>)
}

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT payload FROM audits WHERE id = ${id} LIMIT 1`

  if (!rows.length) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = rows[0].payload as Record<string, any>

  return <AuditReport data={data} />
}
