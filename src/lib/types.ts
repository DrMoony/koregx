import type { Drug, Approval, SourceDocument } from '@prisma/client'

export type Region = 'KR' | 'FDA' | 'EMA' | 'PMDA' | 'NMPA'

export type DrugWithApprovals = Drug & {
  approvals: Approval[]
}

export type DrugWithFullDetail = Drug & {
  approvals: Approval[]
  sourceDocs: SourceDocument[]
}

export interface DrugSearchQuery {
  q: string
  region?: Region
  limit?: number
  offset?: number
}

export interface DrugSearchResult {
  drugs: DrugWithApprovals[]
  total: number
  limit: number
  offset: number
}

export interface IngestResult {
  source: string
  fetched: number
  inserted: number
  updated: number
  errors: Array<{ id?: string; error: string }>
  durationMs: number
}
