import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { HiraSource } = await import('@/lib/sources/hira')
  const src = new HiraSource()

  for (const body of ['dbc', 'cancer'] as const) {
    console.log(`\n── Ingesting hira/${body} ──────────────────────────────────────`)
    const r = await src.ingestRecent(body, 10, 2)
    console.log(
      `${body}: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, errors=${r.errors.length}, duration=${r.durationMs}ms`,
    )
    if (r.errors.length > 0) {
      console.log(
        '  errors:',
        r.errors.slice(0, 5).map((e) => `[${e.id ?? '?'}] ${e.error}`),
      )
    }
  }

  console.log('\n── Done ──────────────────────────────────────────────────────────')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
