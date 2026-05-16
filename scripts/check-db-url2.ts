import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const raw = readFileSync(envPath, 'utf8')
for (const line of raw.split('\n')) {
  const eqIdx = line.indexOf('=')
  if (eqIdx === -1) continue
  const key = line.slice(0, eqIdx).trim()
  const val = line.slice(eqIdx + 1).trim()
  if (key === 'DATABASE_URL') {
    try {
      const u = new URL(val)
      console.log('protocol:', u.protocol)
      console.log('host:', u.host)
      console.log('pathname:', u.pathname)
      console.log('password length:', u.password.length)
    } catch (e) {
      console.log('URL parse error:', e)
      console.log('raw (no pw):', val.replace(/:([^@]+)@/, ':***@'))
    }
  }
}
