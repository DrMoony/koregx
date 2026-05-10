import type { Region, IngestResult } from '@drmoony/koregx-shared'

export abstract class SourcePlugin {
  abstract name: string
  abstract region: Region

  abstract fetch(...args: unknown[]): Promise<unknown[]>
  abstract parse(raw: unknown): Promise<unknown[]>

  async persist(_items: unknown[]): Promise<{ inserted: number; updated: number }> {
    return { inserted: 0, updated: 0 }
  }

  async run(...args: unknown[]): Promise<IngestResult> {
    const start = Date.now()
    const errors: Array<{ id?: string; error: string }> = []
    let fetched = 0
    const allParsed: unknown[] = []

    try {
      const rawItems = await this.fetch(...args)
      fetched = rawItems.length
      for (const raw of rawItems) {
        try {
          const parsed = await this.parse(raw)
          allParsed.push(...parsed)
        } catch (e) {
          errors.push({ error: e instanceof Error ? e.message : String(e) })
        }
      }
    } catch (e) {
      errors.push({ error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    let inserted = 0
    let updated = 0
    if (allParsed.length > 0) {
      const persistResult = await this.persist(allParsed)
      inserted = persistResult.inserted
      updated = persistResult.updated
    }

    return {
      source: this.name,
      fetched,
      inserted,
      updated,
      errors,
      durationMs: Date.now() - start,
    }
  }
}
