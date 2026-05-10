// Re-export shared (non-Prisma) types from @drmoony/koregx-shared
export type {
  Region,
  IngestResult,
  LawSearchQuery,
  LawSearchResult,
  InterpretationSearchQuery,
  InterpretationSearchResult,
  AdminRuleSearchQuery,
  AdminRuleSearchResult,
} from '@drmoony/koregx-shared'

import type { Law, LawArticle, LegalInterpretation, AdminRule, HiraDecision, MfdsRuling, Citation } from '@prisma/client'

// Prisma-dependent composite types (kept here — require generated @prisma/client types)
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

// Re-export Prisma model types for convenience
export type { Law, LawArticle, LegalInterpretation, AdminRule, HiraDecision, MfdsRuling, Citation }
