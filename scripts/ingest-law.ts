import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

import type { ParsedLawSearch } from '@/lib/sources/law-go-kr'

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { LawGoKrSource } = await import('@/lib/sources/law-go-kr')
  const oc = process.env.LAW_OC
  if (!oc) throw new Error('LAW_OC env not set')
  const src = new LawGoKrSource({ oc })

  const targetLaws: Array<{
    query: string
    filter: (l: ParsedLawSearch) => boolean
  }> = [
    {
      query: '약사법',
      filter: (l) => l.nameKor === '약사법' || l.nameKor.startsWith('약사법 시행'),
    },
    {
      query: '의료기기법',
      filter: (l) => l.nameKor === '의료기기법' || l.nameKor.startsWith('의료기기법 시행'),
    },
    {
      query: '첨단재생의료',
      filter: (l) =>
        l.nameKor.includes('첨단재생의료') || l.nameKor.includes('첨단바이오의약품'),
    },
    {
      query: '국민건강보험법',
      filter: (l) => l.nameKor.startsWith('국민건강보험법'),
    },
    {
      query: '마약류',
      filter: (l) => l.nameKor.includes('마약류'),
    },
    {
      query: '희귀질환관리법',
      filter: (l) => l.nameKor.includes('희귀질환'),
    },
    {
      query: '혁신의료기기',
      filter: (l) => l.nameKor.includes('혁신의료기기'),
    },
  ]

  console.log('=== Law ingest ===')
  let totalLaw = 0
  let totalArticles = 0
  for (const t of targetLaws) {
    console.log(`  Ingesting: ${t.query}...`)
    const r = await src.ingestLawByQuery(t.query, { bodyFilter: t.filter, limit: 20 })
    console.log(
      `  ${t.query}: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, errors=${r.errors.length}, ${r.durationMs}ms`,
    )
    if (r.errors.length > 0) {
      r.errors.forEach((e) => console.warn(`    ERROR: ${e.error}`))
    }
    totalLaw += r.inserted + r.updated
    await sleep(200) // gentle rate limiting
  }

  console.log('\n=== Expc ingest ===')
  for (const q of ['약사법', '의료기기', '의약품']) {
    console.log(`  Ingesting expc: ${q}...`)
    const r = await src.ingestExpcByQuery(q, { limit: 50 })
    console.log(
      `  expc ${q}: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, errors=${r.errors.length}, ${r.durationMs}ms`,
    )
    if (r.errors.length > 0) {
      r.errors.slice(0, 3).forEach((e) => console.warn(`    ERROR: ${e.error}`))
    }
    await sleep(300)
  }

  console.log('\n=== Admrul ingest ===')
  for (const q of ['의약품', '의료기기', '임상시험']) {
    console.log(`  Ingesting admrul: ${q}...`)
    const r = await src.ingestAdmrulByQuery(q, { limit: 50, fetchBody: false })
    console.log(
      `  admrul ${q}: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, errors=${r.errors.length}, ${r.durationMs}ms`,
    )
    if (r.errors.length > 0) {
      r.errors.slice(0, 3).forEach((e) => console.warn(`    ERROR: ${e.error}`))
    }
    await sleep(200)
  }

  // Final DB count
  const { prisma } = await import('@/lib/db')
  const [lawCount, articleCount, expcCount, admrulCount] = await Promise.all([
    prisma.law.count(),
    prisma.lawArticle.count(),
    prisma.legalInterpretation.count(),
    prisma.adminRule.count(),
  ])
  console.log('\n=== DB state after ingest ===')
  console.log(`Law:                ${lawCount}`)
  console.log(`LawArticle:         ${articleCount}`)
  console.log(`LegalInterpretation:${expcCount}`)
  console.log(`AdminRule:          ${admrulCount}`)
  console.log(`\nTotal laws processed: ${totalLaw}`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
