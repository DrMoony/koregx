/**
 * Semantic vector search — KoRegX shim
 *
 * Thin wrapper around @drmoony/koregx-shared/llm createSearchClient.
 * Injects KoRegX prisma + embeddingClient at module level.
 */
import { prisma } from '@/lib/db'
import {
  createSearchClient,
  createEmbeddingClient,
  type VectorSearchHit,
  type InterpretationHitEntity,
  type AdminRuleHitEntity,
  type SearchDb,
} from '@drmoony/koregx-shared/llm'

export type { VectorSearchHit, InterpretationHitEntity, AdminRuleHitEntity }

// SearchDb adapter — bridges SearchDb interface to KoRegX prisma client
const searchDb: SearchDb = {
  queryRaw<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (prisma.$queryRawUnsafe as (sql: string, ...args: unknown[]) => Promise<T[]>)(
      sql,
      ...params,
    )
  },
}

// EmbeddingClient — apiKey injected at call time from env
function getEmbedFn() {
  const apiKey = process.env.GEMINI_API_KEY ?? ''
  const client = createEmbeddingClient({ apiKey })
  return client.embed.bind(client)
}

const searchClient = createSearchClient({
  embedFn: getEmbedFn(),
  db: searchDb,
})

export const semanticSearchInterpretations = searchClient.semanticSearchInterpretations.bind(
  searchClient,
)
export const semanticSearchAdminRules = searchClient.semanticSearchAdminRules.bind(searchClient)
