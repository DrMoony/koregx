/**
 * law-go-kr — KoRegX adapter
 *
 * HTTP fetch + parse logic lives in @drmoony/koregx-shared/sources.
 * This module re-exports shared types/parsers and adds KoRegX-specific
 * Prisma persist methods + ingest orchestrators.
 */
export {
  // Types
  type ParsedLawSearch,
  type ParsedLawArticle,
  type ParsedExpc,
  type ParsedAdmrul,
  type ParsedPrec,
  type LawGoKrOpts,
  type CreateLawGoKrClientOpts,
  type SearchOpts,
  type SearchPrecOpts,
  // Parsers
  parseYyyymmdd,
  parseLawSearchItem,
  parseLawArticle,
  parseExpcSearchItem,
  parseExpcDetail,
  parseAdmrulSearchItem,
  parseAdmrulDetail,
  parsePrecSearchItem,
  // Factory
  createLawGoKrClient,
} from '@drmoony/koregx-shared/sources'

import {
  LawGoKrSource as LawGoKrSourceBase,
  type LawGoKrOpts,
  type ParsedLawSearch,
  type ParsedLawArticle,
  type ParsedExpc,
  type ParsedAdmrul,
  parseYyyymmdd,
  parseExpcSearchItem,
  parseExpcDetail,
  parseAdmrulDetail,
  parseLawSearchItem,
  parseLawArticle,
  parseAdmrulSearchItem,
} from '@drmoony/koregx-shared/sources'
import { prisma } from '@/lib/db'
import type { IngestResult } from '@drmoony/koregx-shared'

// ─── KoRegX-extended class (adds Prisma persist + ingest) ─────────────────

export class LawGoKrSource extends LawGoKrSourceBase {
  // ─── Persist methods ────────────────────────────────────────────────────

  async persistLaw(
    parsed: ParsedLawSearch,
    articles: ParsedLawArticle[],
  ): Promise<{ inserted: number; updated: number }> {
    const existing = await prisma.law.findUnique({ where: { mst: parsed.mst } })
    const law = await prisma.law.upsert({
      where: { mst: parsed.mst },
      create: {
        mst: parsed.mst,
        lawId: parsed.lawId,
        nameKor: parsed.nameKor,
        shortName: parsed.shortName,
        category: parsed.category,
        agencyName: parsed.agencyName,
        agencyCode: parsed.agencyCode,
        effectiveDate: parsed.effectiveDate,
        promulgationDate: parsed.promulgationDate,
        promulgationNo: parsed.promulgationNo,
        amendmentType: parsed.amendmentType,
        rawData: parsed.rawData as object,
      },
      update: {
        nameKor: parsed.nameKor,
        shortName: parsed.shortName,
        category: parsed.category,
        agencyName: parsed.agencyName,
        agencyCode: parsed.agencyCode,
        effectiveDate: parsed.effectiveDate,
        promulgationDate: parsed.promulgationDate,
        promulgationNo: parsed.promulgationNo,
        amendmentType: parsed.amendmentType,
        rawData: parsed.rawData as object,
        updatedAt: new Date(),
      },
    })

    // Replace articles for this law (simpler than diff; articles update together)
    if (articles.length > 0) {
      await prisma.lawArticle.deleteMany({ where: { lawId: law.id } })
      for (const a of articles) {
        await prisma.lawArticle.upsert({
          where: {
            lawId_articleNo_articleSubNo: {
              lawId: law.id,
              articleNo: a.articleNo,
              articleSubNo: a.articleSubNo ?? '',
            },
          },
          create: {
            lawId: law.id,
            articleNo: a.articleNo,
            articleSubNo: a.articleSubNo,
            title: a.title,
            body: a.body,
            effectiveDate: a.effectiveDate,
            changedFlag: a.changedFlag,
            rawData: a.rawData as object,
          },
          update: {
            title: a.title,
            body: a.body,
            effectiveDate: a.effectiveDate,
            changedFlag: a.changedFlag,
            rawData: a.rawData as object,
          },
        })
      }
    }

    return existing ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 }
  }

  async persistExpc(parsed: ParsedExpc): Promise<{ inserted: number; updated: number }> {
    const existing = await prisma.legalInterpretation.findUnique({
      where: { ipNo: parsed.ipNo },
    })
    await prisma.legalInterpretation.upsert({
      where: { ipNo: parsed.ipNo },
      create: {
        ipNo: parsed.ipNo,
        caseNo: parsed.caseNo,
        title: parsed.title,
        inquirer: parsed.inquirer,
        respondent: parsed.respondent,
        responseDate: parsed.responseDate,
        body: parsed.body,
        rawData: parsed.rawData as object,
      },
      update: {
        title: parsed.title,
        body: parsed.body,
        inquirer: parsed.inquirer,
        respondent: parsed.respondent,
        responseDate: parsed.responseDate,
        rawData: parsed.rawData as object,
        updatedAt: new Date(),
      },
    })
    return existing ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 }
  }

  async persistAdmrul(parsed: ParsedAdmrul): Promise<{ inserted: number; updated: number }> {
    const existing = await prisma.adminRule.findUnique({ where: { arNo: parsed.arNo } })
    await prisma.adminRule.upsert({
      where: { arNo: parsed.arNo },
      create: {
        arNo: parsed.arNo,
        name: parsed.name,
        agencyName: parsed.agencyName,
        ruleType: parsed.ruleType,
        promulgationDate: parsed.promulgationDate,
        amendmentCode: parsed.amendmentCode,
        body: parsed.body,
        rawData: parsed.rawData as object,
      },
      update: {
        name: parsed.name,
        body: parsed.body,
        promulgationDate: parsed.promulgationDate,
        amendmentCode: parsed.amendmentCode,
        rawData: parsed.rawData as object,
        updatedAt: new Date(),
      },
    })
    return existing ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 }
  }

  // ─── High-level ingest orchestrators ───────────────────────────────────

  async ingestLawByQuery(
    query: string,
    opts: { limit?: number; bodyFilter?: (l: ParsedLawSearch) => boolean } = {},
  ): Promise<IngestResult> {
    const start = Date.now()
    const errors: Array<{ id?: string; error: string }> = []
    let fetched = 0
    let inserted = 0
    let updated = 0

    try {
      const items = await this.fetchLawSearch(query, opts.limit ?? 50)
      fetched = items.length
      for (const item of items) {
        try {
          const parsed = parseLawSearchItem(item)
          if (opts.bodyFilter && !opts.bodyFilter(parsed)) continue

          const detail = await this.fetchLawDetail(parsed.mst)
          const articles = (detail.articles ?? []).map((a) => parseLawArticle(a))
          const result = await this.persistLaw(parsed, articles)
          inserted += result.inserted
          updated += result.updated
        } catch (e) {
          errors.push({ error: e instanceof Error ? e.message : String(e) })
        }
      }
    } catch (e) {
      errors.push({ error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    return {
      source: 'law-go-kr/law',
      fetched,
      inserted,
      updated,
      errors,
      durationMs: Date.now() - start,
    }
  }

  async ingestExpcByQuery(
    query: string,
    opts: { limit?: number } = {},
  ): Promise<IngestResult> {
    const start = Date.now()
    const errors: Array<{ id?: string; error: string }> = []
    let fetched = 0
    let inserted = 0
    let updated = 0

    try {
      const items = await this.fetchExpcSearch(query, opts.limit ?? 50)
      fetched = items.length
      for (const item of items) {
        try {
          const meta = parseExpcSearchItem(item)
          const detailRaw = await this.fetchExpcDetail(meta.ipNo)
          const detail = parseExpcDetail(detailRaw)
          const parsed: ParsedExpc = {
            ipNo: meta.ipNo,
            caseNo: detail.caseNo ?? meta.caseNo,
            title: meta.title,
            inquirer: detail.inquirer ?? (typeof item['질의기관명'] === 'string' ? item['질의기관명'].trim() || undefined : undefined),
            respondent: detail.respondent,
            responseDate:
              detail.responseDate ??
              parseYyyymmdd(item['회신일자']),
            body: detail.body,
            rawData: item,
          }
          const result = await this.persistExpc(parsed)
          inserted += result.inserted
          updated += result.updated
        } catch (e) {
          errors.push({ error: e instanceof Error ? e.message : String(e) })
        }
      }
    } catch (e) {
      errors.push({ error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    return {
      source: 'law-go-kr/expc',
      fetched,
      inserted,
      updated,
      errors,
      durationMs: Date.now() - start,
    }
  }

  async ingestAdmrulByQuery(
    query: string,
    opts: { limit?: number; fetchBody?: boolean } = {},
  ): Promise<IngestResult> {
    const start = Date.now()
    const errors: Array<{ id?: string; error: string }> = []
    let fetched = 0
    let inserted = 0
    let updated = 0

    try {
      const items = await this.fetchAdmrulSearch(query, opts.limit ?? 50)
      fetched = items.length
      for (const item of items) {
        try {
          const parsed = parseAdmrulSearchItem(item)
          if (opts.fetchBody) {
            try {
              const detailRaw = await this.fetchAdmrulDetail(parsed.arNo)
              const detail = parseAdmrulDetail(detailRaw)
              parsed.body = detail.body
            } catch {
              // body optional — leave as undefined
            }
          }
          const result = await this.persistAdmrul(parsed)
          inserted += result.inserted
          updated += result.updated
        } catch (e) {
          errors.push({ error: e instanceof Error ? e.message : String(e) })
        }
      }
    } catch (e) {
      errors.push({ error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    return {
      source: 'law-go-kr/admrul',
      fetched,
      inserted,
      updated,
      errors,
      durationMs: Date.now() - start,
    }
  }
}
