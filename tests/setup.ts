import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env.local for tests
config({ path: resolve(process.cwd(), '.env.local') })

// Refuse to run tests in production
if (process.env.NODE_ENV === 'production') {
  throw new Error('Tests cannot run in NODE_ENV=production')
}
