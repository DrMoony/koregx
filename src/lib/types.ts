import type { Law, LawArticle, LegalInterpretation, AdminRule, HiraDecision, MfdsRuling, Citation } from '@prisma/client'

export type Region = 'KR' | 'FDA' | 'EMA' | 'PMDA' | 'NMPA'

export interface IngestResult {
  source: string
  fetched: number
  inserted: number
  updated: number
  errors: Array<{ id?: string; error: string }>
  durationMs: number
}

// Composite types
export type LawWithArticles = Law & {
  articles: LawArticle[]
}

export type LawWithFullDetail = Law & {
  articles: LawArticle[]
  interpretations: LegalInterpretation[]
}

export type InterpretationWithLaw = LegalInterpretation & {
  law: Law | null
}

// Search query/result shapes
export interface LawSearchQuery {
  q: string
  category?: string
  agencyName?: string
  limit?: number
  offset?: number
}

export interface LawSearchResult {
  laws: Law[]
  total: number
  limit: number
  offset: number
}

export interface InterpretationSearchQuery {
  q: string
  lawShortName?: string
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

export interface InterpretationSearchResult {
  items: InterpretationWithLaw[]
  total: number
  limit: number
  offset: number
}

export interface AdminRuleSearchQuery {
  q: string
  agency?: string
  ruleType?: string
  limit?: number
  offset?: number
}

export interface AdminRuleSearchResult {
  items: AdminRule[]
  total: number
  limit: number
  offset: number
}

// Re-export Prisma model types for convenience
export type { Law, LawArticle, LegalInterpretation, AdminRule, HiraDecision, MfdsRuling, Citation }
