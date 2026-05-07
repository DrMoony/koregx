import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { ingestMfds } = await import('@/lib/sources/ingest')

  const query = process.argv[2] ?? '위고비'
  const limit = Number(process.argv[3] ?? 20)

  console.log(`MFDS ingest: query="${query}" limit=${limit}`)

  try {
    const result = await ingestMfds(query, limit)
    console.log(JSON.stringify(result, null, 2))
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e))
    throw e
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
