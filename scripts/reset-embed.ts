import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') , override: true })

async function main() {
  const { prisma } = await import('@/lib/db')
  const r1 = await prisma.$executeRawUnsafe(`UPDATE "LegalInterpretation" SET "bodyEmbedding" = NULL`)
  console.log(`reset LegalInterpretation: ${r1} rows`)
  const r2 = await prisma.$executeRawUnsafe(`UPDATE "HiraDecision" SET "rationaleEmbed" = NULL`)
  console.log(`reset HiraDecision: ${r2} rows`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
