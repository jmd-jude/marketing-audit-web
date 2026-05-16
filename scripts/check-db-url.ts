import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const raw = readFileSync(envPath, 'utf8')
const lines = raw.split('\n')
for (const line of lines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const val = match[2].trim()
    process.env[key] = val
    if (key === 'DATABASE_URL') {
      console.log('Found DATABASE_URL, prefix:', val.slice(0, 50))
      console.log('Has quotes?', val.startsWith('"') || val.startsWith("'"))
    }
  }
}
