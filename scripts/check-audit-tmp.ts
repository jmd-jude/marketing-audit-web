import { readFileSync } from 'fs'
import { resolve } from 'path'
import { neon } from '@neondatabase/serverless'

const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    let val = match[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[match[1].trim()] = val
  }
}

async function main() {
  const rawUrl = process.env.DATABASE_URL!
  const cleanUrl = rawUrl.split('?')[0]
  const sql = neon(cleanUrl)
  const rows = await sql`SELECT payload->>'agents' as agents FROM audits WHERE id = 'c3f9002b-4225-488b-a38a-572f52a883cf'`
  const agents = JSON.parse(rows[0]?.agents || 'null') as any
  if (agents) {
    for (const v of (agents as any[])) {
      console.log('--- AGENT:', v.key, '| score:', v.score, '---')
      console.log('result keys:', v.result ? Object.keys(v.result) : 'NO RESULT')
      if (v.result?.error) console.log('ERROR:', v.result.error)
      if (v.result?.raw) console.log('raw (full):', v.result.raw)
      if (v.result?.dimensions) console.log('dimensions count:', v.result.dimensions.length)
      console.log()
    }
  } else {
    console.log('No row found. rows:', rows)
  }
}
main()
