import { SourcePlugin } from '@drmoony/koregx-shared/sources'
import { prisma } from '@/lib/db'
import type { Region, IngestResult } from '@drmoony/koregx-shared'

const LAW_GO_KR_BASE = 'https://www.law.go.kr/DRF'

// ─── Raw API response types ────────────────────────────────────────────────

interface LawSearchResponseRaw {
  LawSearch: {
    law: Record<string, unknown>[]
    totalCnt: number | string
  }
}

interface LawDetailResponseRaw {
  법령: {
    기본정보: Record<string, unknown>
    조문: { 조문단위: Record<string, unknown>[] }
    부칙?: unknown
    개정문?: unknown
    제개정이유?: unknown
  }
}

// ─── Parsed shapes ─────────────────────────────────────────────────────────

export interface ParsedLawSearch {
  mst: string
  lawId: string
  nameKor: string
  shortName?: string
  category: string
  agencyName: string
  agencyCode?: string
  effectiveDate?: Date
  promulgationDate?: Date
  promulgationNo?: string
  amendmentType?: string
  rawData: Record<string, unknown>
}

export interface ParsedLawArticle {
  articleNo: string
  articleSubNo?: string
  title?: string
  body: string
  effectiveDate?: Date
  changedFlag: boolean
  rawData: Record<string, unknown>
}

export interface ParsedExpc {
  ipNo: string
  caseNo?: string
  title: string
  inquirer?: string
  respondent: string
  responseDate?: Date
  body: string
  rawData: Record<string, unknown>
}

export interface ParsedAdmrul {
  arNo: string
  name: string
  agencyName: string
  ruleType: string
  promulgationDate?: Date
  amendmentCode?: string
  body?: string
  rawData: Record<string, unknown>
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parses YYYYMMDD → Date (UTC midnight). Also handles "YYYY.MM.DD" format. */
export function parseYyyymmdd(s: unknown): Date | undefined {
  if (typeof s !== 'string') return undefined
  const cleaned = s.replace(/[^0-9]/g, '')
  if (cleaned.length !== 8) return undefined
  return new Date(
    `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00Z`,
  )
}

function trimOrUndef(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

function mustString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`missing required field: ${field}`)
  }
  return v.trim()
}

// ─── Parsers ───────────────────────────────────────────────────────────────

export function parseLawSearchItem(item: Record<string, unknown>): ParsedLawSearch {
  return {
    mst: mustString(item['법령일련번호'], '법령일련번호'),
    lawId: mustString(item['법령ID'], '법령ID'),
    nameKor: mustString(item['법령명한글'], '법령명한글'),
    shortName: trimOrUndef(item['법령약칭명']),
    category: mustString(item['법령구분명'], '법령구분명'),
    agencyName: mustString(item['소관부처명'], '소관부처명'),
    agencyCode: trimOrUndef(item['소관부처코드']),
    effectiveDate: parseYyyymmdd(item['시행일자']),
    promulgationDate: parseYyyymmdd(item['공포일자']),
    promulgationNo: trimOrUndef(item['공포번호']),
    amendmentType: trimOrUndef(item['제개정구분명']),
    rawData: item,
  }
}

export function parseLawArticle(item: Record<string, unknown>): ParsedLawArticle {
  const rawNo = String(item['조문번호'] ?? '')
  const subNo = trimOrUndef(item['조문가지번호'])
  return {
    articleNo: rawNo,
    articleSubNo: subNo,
    title: trimOrUndef(item['조문제목']),
    body: trimOrUndef(item['조문내용']) ?? '',
    effectiveDate: parseYyyymmdd(item['조문시행일자']),
    changedFlag:
      typeof item['조문변경여부'] === 'string' &&
      item['조문변경여부'].trim() !== 'N' &&
      item['조문변경여부'].trim() !== '',
    rawData: item,
  }
}

export function parseExpcSearchItem(
  item: Record<string, unknown>,
): Pick<ParsedExpc, 'ipNo' | 'caseNo' | 'title' | 'respondent' | 'rawData'> {
  return {
    ipNo: mustString(item['법령해석례일련번호'], '법령해석례일련번호'),
    caseNo: trimOrUndef(item['안건번호']),
    title: mustString(item['안건명'], '안건명'),
    // Expc search uses 회신기관명 (not 해석기관명)
    respondent: trimOrUndef(item['회신기관명']) ?? trimOrUndef(item['해석기관명']) ?? '법제처',
    rawData: item,
  }
}

/**
 * Parse the ExpcService detail response.
 * Root key: ExpcService. Body composed from 회답 + 이유.
 */
export function parseExpcDetail(raw: Record<string, unknown>): {
  body: string
  inquirer?: string
  respondent: string
  responseDate?: Date
  caseNo?: string
} {
  const root = (raw['ExpcService'] ?? raw) as Record<string, unknown>
  const answer = trimOrUndef(root['회답']) ?? ''
  const reason = trimOrUndef(root['이유']) ?? ''
  const body = [answer, reason].filter(Boolean).join('\n\n') || JSON.stringify(root).slice(0, 5000)
  return {
    body,
    inquirer: trimOrUndef(root['질의기관명']),
    respondent: trimOrUndef(root['해석기관명']) ?? '법제처',
    responseDate: parseYyyymmdd(root['해석일자']),
    caseNo: trimOrUndef(root['안건번호']),
  }
}

export function parseAdmrulSearchItem(item: Record<string, unknown>): ParsedAdmrul {
  return {
    arNo: mustString(item['행정규칙일련번호'], '행정규칙일련번호'),
    name: mustString(item['행정규칙명'], '행정규칙명'),
    agencyName: mustString(item['소관부처명'], '소관부처명'),
    ruleType: mustString(item['행정규칙종류'], '행정규칙종류'),
    promulgationDate: parseYyyymmdd(item['발령일자']),
    amendmentCode: trimOrUndef(item['제개정구분코드']),
    rawData: item,
  }
}

/**
 * Parse AdmRulService detail response.
 * Root: AdmRulService. Body in 조문내용 (string array).
 */
export function parseAdmrulDetail(raw: Record<string, unknown>): { body?: string } {
  const root = (raw['AdmRulService'] ?? raw) as Record<string, unknown>
  const 조문 = root['조문내용']
  if (Array.isArray(조문)) {
    const body = 조문
      .map((item: unknown) => {
        if (typeof item === 'string') return item
        if (typeof item === 'object' && item !== null)
          return Object.values(item as Record<string, unknown>)
            .map(String)
            .join(' ')
        return String(item)
      })
      .join('\n')
    return { body: body.trim() || undefined }
  }
  if (typeof 조문 === 'string') return { body: 조문.trim() || undefined }
  return { body: undefined }
}

// ─── Source class ──────────────────────────────────────────────────────────

export interface LawGoKrOpts {
  oc: string
  baseUrl?: string
}

export class LawGoKrSource extends SourcePlugin {
  name = 'law-go-kr'
  region = 'KR' as const
  oc: string
  baseUrl: string

  constructor(opts: LawGoKrOpts) {
    super()
    this.oc = opts.oc
    this.baseUrl = opts.baseUrl ?? LAW_GO_KR_BASE
  }

  // SourcePlugin abstract requires fetch/parse — no-op here (target-specific methods used instead)
  async fetch(): Promise<unknown[]> {
    return []
  }
  async parse(): Promise<unknown[]> {
    return []
  }

  // ─── Target-specific fetch methods ─────────────────────────────────────

  async fetchLawSearch(query: string, display = 50): Promise<Record<string, unknown>[]> {
    const url = `${this.baseUrl}/lawSearch.do?OC=${this.oc}&target=law&type=JSON&query=${encodeURIComponent(query)}&display=${display}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`law-go-kr law search failed: ${res.status}`)
    const data = (await res.json()) as LawSearchResponseRaw
    return data.LawSearch?.law ?? []
  }

  async fetchLawDetail(
    mst: string,
  ): Promise<{ basic: Record<string, unknown>; articles: Record<string, unknown>[] }> {
    const url = `${this.baseUrl}/lawService.do?OC=${this.oc}&target=law&MST=${mst}&type=JSON`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`law-go-kr law detail failed: ${res.status}`)
    const data = (await res.json()) as LawDetailResponseRaw
    const root = data.법령
    if (!root) throw new Error(`law detail empty for MST ${mst}`)
    return {
      basic: (root.기본정보 ?? {}) as Record<string, unknown>,
      articles: (root.조문?.조문단위 ?? []) as Record<string, unknown>[],
    }
  }

  /**
   * Expc search — root key is 'Expc', items under 'expc'.
   * Different from law search which uses LawSearch/law.
   */
  async fetchExpcSearch(query: string, display = 50): Promise<Record<string, unknown>[]> {
    const url = `${this.baseUrl}/lawSearch.do?OC=${this.oc}&target=expc&type=JSON&query=${encodeURIComponent(query)}&display=${display}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`law-go-kr expc search failed: ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>
    // Actual root: 'Expc', items under 'expc'
    const root = (data['Expc'] as Record<string, unknown>) ?? {}
    const list = root['expc'] ?? []
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  }

  /**
   * Expc detail — JSON type supported. Root: ExpcService.
   * Falls back to HTML scrape if JSON fails.
   */
  async fetchExpcDetail(ipNo: string): Promise<Record<string, unknown>> {
    const jsonUrl = `${this.baseUrl}/lawService.do?OC=${this.oc}&target=expc&ID=${ipNo}&type=JSON`
    const jsonRes = await fetch(jsonUrl)
    if (jsonRes.ok) {
      const data = (await jsonRes.json()) as Record<string, unknown>
      if (data['ExpcService']) return data
    }
    // Fall back to HTML scrape
    const htmlUrl = `${this.baseUrl}/lawService.do?OC=${this.oc}&target=expc&ID=${ipNo}&type=HTML`
    const htmlRes = await fetch(htmlUrl)
    if (!htmlRes.ok)
      throw new Error(`expc detail failed (both JSON and HTML): ${htmlRes.status}`)
    const html = await htmlRes.text()
    const body = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // Synthesize an ExpcService-shaped object so parseExpcDetail works
    return { ExpcService: { 회답: body.slice(0, 50000), 해석기관명: '법제처' } }
  }

  /**
   * Admrul search — root key 'AdmRulSearch', items under 'admrul'.
   */
  async fetchAdmrulSearch(query: string, display = 50): Promise<Record<string, unknown>[]> {
    const url = `${this.baseUrl}/lawSearch.do?OC=${this.oc}&target=admrul&type=JSON&query=${encodeURIComponent(query)}&display=${display}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`law-go-kr admrul search failed: ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>
    const root = (data['AdmRulSearch'] as Record<string, unknown>) ?? {}
    const list = root['admrul'] ?? []
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : []
  }

  /**
   * Admrul detail — uses ID= param (not LID=). Root: AdmRulService.
   * Falls back to HTML if JSON fails/empty.
   */
  async fetchAdmrulDetail(arNo: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/lawService.do?OC=${this.oc}&target=admrul&ID=${arNo}&type=JSON`
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>
      if (data['AdmRulService']) return data
    }
    // Fall back to HTML
    const htmlUrl = `${this.baseUrl}/lawService.do?OC=${this.oc}&target=admrul&ID=${arNo}&type=HTML`
    const htmlRes = await fetch(htmlUrl)
    if (!htmlRes.ok) throw new Error(`admrul detail failed: ${htmlRes.status}`)
    const html = await htmlRes.text()
    const body = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return { AdmRulService: { 조문내용: body.slice(0, 100000) } }
  }

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
      // createMany with unique constraint: [lawId, articleNo, articleSubNo]
      // Some laws have duplicate articleNo (sections w/o subNo), use updateMany for safety
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
            inquirer: detail.inquirer ?? trimOrUndef(item['질의기관명']),
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
