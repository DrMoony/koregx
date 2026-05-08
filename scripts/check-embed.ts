import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') , override: true })

async function main() {
  const { prisma } = await import('@/lib/db')
  const total = await prisma.legalInterpretation.count()
  const withEmbed = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(`SELECT count(*)::text as cnt FROM "LegalInterpretation" WHERE "bodyEmbedding" IS NOT NULL`)
  const withBody = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(`SELECT count(*)::text as cnt FROM "LegalInterpretation" WHERE length(body) > 50`)
  console.log('total LegalInterpretation:', total)
  console.log('with embedding:', withEmbed[0].cnt)
  console.log('with body>50:', withBody[0].cnt)

  const totalH = await prisma.hiraDecision.count()
  const withHE = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(`SELECT count(*)::text as cnt FROM "HiraDecision" WHERE "rationaleEmbed" IS NOT NULL`)
  const withHB = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(`SELECT count(*)::text as cnt FROM "HiraDecision" WHERE rationale IS NOT NULL AND length(rationale) > 50`)
  console.log('total HiraDecision:', totalH)
  console.log('with rationaleEmbed:', withHE[0].cnt)
  console.log('with rationale>50:', withHB[0].cnt)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
