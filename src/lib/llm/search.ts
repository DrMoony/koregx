/**
 * Semantic vector search over pgvector columns.
 * Uses raw SQL with <=> cosine distance operator.
 */
import { prisma } from '@/lib/db'
import { embed } from './embedding'

export interface VectorSearchHit<T = unknown> {
  id: string
  distance: number
  entity: T
}

export interface InterpretationHitEntity {
  id: string
  title: string
  body: string
  caseNo: string | null
  responseDate: Date | null
}

export interface AdminRuleHitEntity {
  id: string
  name: string
  body: string | undefined
  ruleType: string
  agencyName: string
}

export async function semanticSearchInterpretations(
  query: string,
  k = 5,
): Promise<VectorSearchHit<InterpretationHitEntity>[]> {
  const vec = await embed(query)
  const literal = '[' + vec.join(',') + ']'
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      title: string
      body: string
      case_no: string | null
      response_date: Date | null
      distance: number
    }>
  >(
    `
    SELECT id, title, body, "caseNo" as case_no, "responseDate" as response_date,
           "bodyEmbedding" <=> $1::vector as distance
    FROM "LegalInterpretation"
    WHERE "bodyEmbedding" IS NOT NULL
    ORDER BY distance ASC
    LIMIT $2
  `,
    literal,
    k,
  )
  return rows.map((r) => ({
    id: r.id,
    distance: Number(r.distance),
    entity: {
      id: r.id,
      title: r.title,
      body: r.body.slice(0, 800),
      caseNo: r.case_no,
      responseDate: r.response_date,
    },
  }))
}

export async function semanticSearchAdminRules(
  query: string,
  k = 5,
): Promise<VectorSearchHit<AdminRuleHitEntity>[]> {
  const vec = await embed(query)
  const literal = '[' + vec.join(',') + ']'
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      body: string | null
      rule_type: string
      agency_name: string
      distance: number
    }>
  >(
    `
    SELECT id, name, body, "ruleType" as rule_type, "agencyName" as agency_name,
           "bodyEmbedding" <=> $1::vector as distance
    FROM "AdminRule"
    WHERE "bodyEmbedding" IS NOT NULL
    ORDER BY distance ASC
    LIMIT $2
  `,
    literal,
    k,
  )
  return rows.map((r) => ({
    id: r.id,
    distance: Number(r.distance),
    entity: {
      id: r.id,
      name: r.name,
      body: r.body?.slice(0, 800),
      ruleType: r.rule_type,
      agencyName: r.agency_name,
    },
  }))
}
