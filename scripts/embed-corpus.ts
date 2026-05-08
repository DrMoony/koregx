/**
 * Embedding ingest script
 *
 * Generates Gemini text-embedding-004 (768d) embeddings for:
 *   - LegalInterpretation.body (83 rows)
 *   - AdminRule.body (124 rows, only those with body)
 *   - HiraDecision.rationale (20 rows)
 *
 * Falls back to hash-based embedding if GEMINI_API_KEY is invalid.
 *
 * Usage:
 *   npm run embed:corpus
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { prisma } = await import('../src/lib/db.js')
  const { embed, getEmbeddingMode } = await import('../src/lib/llm/embedding.js')

  console.log('=== KoRegX Embedding Ingest ===')
  console.log('Embedding mode (will be confirmed on first call):', getEmbeddingMode())

  // ── LegalInterpretation ─────────────────────────────────────────────────────
  console.log('\n=== LegalInterpretation embedding ===')
  const interps = await prisma.$queryRaw<Array<{ id: string; body: string }>>`
    SELECT id, body FROM "LegalInterpretation"
    WHERE "bodyEmbedding" IS NULL AND length(body) > 50
  `
  console.log(`${interps.length} interpretations to embed`)
  let interpCount = 0
  for (const r of interps) {
    try {
      const v = await embed(r.body)
      const literal = '[' + v.join(',') + ']'
      await prisma.$executeRaw`UPDATE "LegalInterpretation" SET "bodyEmbedding" = ${literal}::vector WHERE id = ${r.id}`
      interpCount++
      if (interpCount % 10 === 0) console.log(`  embedded ${interpCount}/${interps.length}`)
    } catch (e) {
      console.error(`  fail ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  console.log(`embedded ${interpCount}/${interps.length} interpretations`)

  // ── AdminRule ───────────────────────────────────────────────────────────────
  console.log('\n=== AdminRule embedding ===')
  const rules = await prisma.$queryRaw<Array<{ id: string; body: string }>>`
    SELECT id, body FROM "AdminRule"
    WHERE "bodyEmbedding" IS NULL AND body IS NOT NULL AND length(body) > 50
  `
  console.log(`${rules.length} admin rules to embed (with body)`)
  let ruleCount = 0
  for (const r of rules) {
    try {
      const v = await embed(r.body)
      const literal = '[' + v.join(',') + ']'
      await prisma.$executeRaw`UPDATE "AdminRule" SET "bodyEmbedding" = ${literal}::vector WHERE id = ${r.id}`
      ruleCount++
      if (ruleCount % 10 === 0) console.log(`  embedded ${ruleCount}/${rules.length}`)
    } catch (e) {
      console.error(`  fail ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  console.log(`embedded ${ruleCount}/${rules.length} admin rules`)

  // ── HiraDecision ────────────────────────────────────────────────────────────
  console.log('\n=== HiraDecision rationale embedding ===')
  const decisions = await prisma.$queryRaw<Array<{ id: string; rationale: string }>>`
    SELECT id, rationale FROM "HiraDecision"
    WHERE "rationaleEmbed" IS NULL AND rationale IS NOT NULL AND length(rationale) > 50
  `
  console.log(`${decisions.length} HIRA decisions to embed`)
  let hiraCount = 0
  for (const r of decisions) {
    try {
      const v = await embed(r.rationale)
      const literal = '[' + v.join(',') + ']'
      await prisma.$executeRaw`UPDATE "HiraDecision" SET "rationaleEmbed" = ${literal}::vector WHERE id = ${r.id}`
      hiraCount++
      if (hiraCount % 10 === 0) console.log(`  embedded ${hiraCount}/${decisions.length}`)
    } catch (e) {
      console.error(`  fail ${r.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  console.log(`embedded ${hiraCount}/${decisions.length} HIRA decisions`)

  console.log('\n=== Summary ===')
  console.log(`LegalInterpretation: ${interpCount} embedded`)
  console.log(`AdminRule: ${ruleCount} embedded`)
  console.log(`HiraDecision: ${hiraCount} embedded`)
  console.log(`Embedding mode used: ${getEmbeddingMode()}`)

  await prisma.$disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
