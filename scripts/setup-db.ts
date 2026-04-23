/**
 * One-time setup script — creates the audits table in Neon.
 * Run with: npx tsx scripts/setup-db.ts
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually — no dotenv dependency needed
const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const sql = neon(process.env.DATABASE_URL!)

async function setup() {
  await sql`
    CREATE TABLE IF NOT EXISTS audits (
      id          UUID PRIMARY KEY,
      timestamp   TIMESTAMPTZ NOT NULL,
      url         TEXT NOT NULL,
      auditor     TEXT,
      composite_score INTEGER,
      connected   BOOLEAN DEFAULT FALSE,
      model       TEXT,
      duration_ms INTEGER,
      email       TEXT,
      payload     JSONB NOT NULL
    )
  `
  await sql`ALTER TABLE audits ADD COLUMN IF NOT EXISTS email TEXT`
  console.log('audits table ready')
}

setup().catch((err) => {
  console.error(err)
  process.exit(1)
})
