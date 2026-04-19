import { neon } from '@neondatabase/serverless'
import { notFound } from 'next/navigation'
import AuditReport from '../audit/[id]/AuditReport'

export default async function SamplePage() {
  const id = process.env.SAMPLE_AUDIT_ID
  if (!id) notFound()

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT payload FROM audits WHERE id = ${id} LIMIT 1`

  if (!rows.length) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = rows[0].payload as Record<string, any>

  return <AuditReport data={data} autoUnlock={true} />
}
