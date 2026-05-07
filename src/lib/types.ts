export type Region = 'KR' | 'FDA' | 'EMA' | 'PMDA' | 'NMPA'

export interface IngestResult {
  source: string
  fetched: number
  inserted: number
  updated: number
  errors: Array<{ id?: string; error: string }>
  durationMs: number
}
