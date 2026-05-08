import { SourcePlugin } from './base'
import { prisma } from '@/lib/db'
import type { Region, IngestResult } from '@/lib/types'
import { createHash } from 'node:crypto'

// ─── Constants ────────────────────────────────────────────────────────────────

const HIRA_BASE = 'https://www.hira.or.kr'

/** pgmid for each board */
const PGMID: Record<HiraBody, string> = {
  dbc: 'HIRAA030014040000', // 약제급여평가위원회 (Drug Benefit Committee)
  cancer: 'HIRAA030023010000', // 암질환심의위원회 공고 (Cancer Drug Announcement)
}

/** bbsTyNo (board type no) per body — used in download URL */
const BBS_TY_NO: Record<HiraBody, string> = {
  dbc: '17',
  cancer: '6',
}

const USER_AGENT = 'KoRegX-bot/0.2 (+https://github.com/DrMoony/koregx)'
const HEADERS: HeadersInit = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/pdf,application/octet-stream',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type HiraBody = 'dbc' | 'cancer'

export interface HiraListingRow {
  brdBltNo: string
  bbsBltNo?: string
  meetingRound?: string
  ingredient?: string
  drug?: string
  company?: string
  ruling?: string
}

export interface HiraDetailMeta {
  brdBltNo: string
  title: string
  postedDate?: string
  /** Array of {seq, filename} download entries */
  files: Array<{ seq: string; name: string }>
  /** bbsBltNo (apndBltNo) — last segment of download URL */
  bbsBltNo?: string
  bbsTyNo?: string
}

export interface ParsedHiraDecision {
  body: HiraBody
  meetingDate: Date
  meetingNo?: number
  agendaNo?: number
  agenda: string
  drug?: string
  ingredient?: string
  ruling: string
  rationale?: string
  sourceUrl: string
  sourceHash: string
  rawData?: Record<string, unknown>
}

// ─── HTML Parsers ─────────────────────────────────────────────────────────────

/**
 * Parse listing page HTML and extract board rows.
 * The listing table columns are: 회차 | 성분명 (title/link) | 제품명 | 업소명 | 평가결과
 * For cancer 공고: 번호 | 공고번호 | 제목 | 제·개정일 | 작성일 | 첨부
 */
export function parseListingHtml(html: string, body: HiraBody): HiraListingRow[] {
  const rows: HiraListingRow[] = []

  if (body === 'dbc') {
    // DBC: table rows with 회차, ingredient (link), product, company, ruling
    // Pattern: col-num2 = 회차; col-tit = ingredient link; col-depart = prod/company/ruling
    const rowPattern =
      /<tr[\s\S]*?<td[^>]*class="col-num2"[^>]*>([\s\S]*?)<\/td>[\s\S]*?brdBltNo=(\d+)[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/g
    let m: RegExpExecArray | null
    while ((m = rowPattern.exec(html)) !== null) {
      const meetingRound = m[1].replace(/<[^>]+>/g, '').trim()
      const brdBltNo = m[2]
      const ingredient = m[3]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .trim()

      // Extract all col-depart cells after the link (prod, company, ruling)
      const rowHtml = m[0]
      const departCells = [...rowHtml.matchAll(/<td[^>]*class="col-depart"[^>]*>([\s\S]*?)<\/td>/g)]
      const drug = departCells[0]?.[1]?.replace(/<[^>]+>/g, '').trim()
      const company = departCells[1]?.[1]?.replace(/<[^>]+>/g, '').trim()
      const ruling = departCells[2]?.[1]?.replace(/<[^>]+>/g, '').trim()

      rows.push({ brdBltNo, meetingRound, ingredient, drug, company, ruling })
    }
  } else {
    // Cancer: 공고 list, extract brdBltNo + title
    const linkPattern = /brdBltNo=(\d+)[^>]*>\s*([^<]+)\s*<\/a>/g
    let m: RegExpExecArray | null
    while ((m = linkPattern.exec(html)) !== null) {
      const brdBltNo = m[1]
      const title = m[2].replace(/&amp;/g, '&').trim()
      if (title && parseInt(brdBltNo, 10) > 0) {
        rows.push({ brdBltNo, ingredient: title })
      }
    }
  }

  return rows
}

/**
 * Parse a detail page HTML to extract metadata and file list.
 * File download calls: downLoadBbs('SEQ','brdBltNo','bbsTyNo','bbsBltNo')
 */
export function parseDetailHtml(html: string): HiraDetailMeta {
  // Title: <div class="title">...</div>
  const titleMatch = html.match(/<div[^>]*class="title"[^>]*>([\s\S]*?)<\/div>/)
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : ''

  // Posted date: <li>2026-04-09</li> (second li after title div)
  const dateMatch = html.match(/class="writer"[\s\S]*?<li>([\s\S]*?)<\/li>[\s\S]*?<li>(\d{4}-\d{2}-\d{2})<\/li>/)
  const postedDate = dateMatch ? dateMatch[2] : undefined

  // Files: downLoadBbs('seq','brdBltNo','bbsTyNo','bbsBltNo')
  // HTML may use single-quoted JS strings: onclick="downLoadBbs('1','47085','17','58')"
  // or double-quoted: onclick='downLoadBbs("1","47085","17","58")'
  const filePattern =
    /class="icon-file-\w+"[^>]*><\/i>\s*([\s\S]*?)\s*<a[^>]*onclick="downLoadBbs\('(\d+)','(\d+)','(\d+)','(\d+)'\)/g
  const files: Array<{ seq: string; name: string }> = []
  let bbsBltNo: string | undefined
  let bbsTyNo: string | undefined

  let fm: RegExpExecArray | null
  while ((fm = filePattern.exec(html)) !== null) {
    const name = fm[1].replace(/<[^>]+>/g, '').trim()
    const seq = fm[2]
    // brdBltNo = fm[3], bbsTyNo = fm[4], bbsBltNo = fm[5]
    bbsTyNo = fm[4]
    bbsBltNo = fm[5]
    if (name && seq) {
      files.push({ seq, name })
    }
  }

  // Also extract brdBltNo from the comment removal POST
  const brdBltNoMatch = html.match(/'brdBltNo'\s*:\s*'(\d+)'/)
  const brdBltNo = brdBltNoMatch ? brdBltNoMatch[1] : ''

  return { brdBltNo, title, postedDate, files, bbsBltNo, bbsTyNo }
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a HIRA evaluation PDF buffer into structured decision data.
 * The PDF contains rich Korean text with meeting date, ruling, and rationale.
 */
export async function parseHiraDecisionsFromPdf(
  buffer: Buffer,
  body: HiraBody,
  sourceUrl: string,
  metadata?: Partial<Pick<ParsedHiraDecision, 'drug' | 'ingredient' | 'meetingNo' | 'agendaNo'>>,
): Promise<ParsedHiraDecision[]> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  const text: string = result.text ?? ''
  const sourceHash = createHash('sha256').update(buffer).digest('hex')

  // Extract meeting date: "YYYY년 제N차 약제급여평가위원회: YYYY년 M월 D일"
  const meetingDateMatch = text.match(
    /(\d{4})년\s+(?:제\s*(\d+)\s*차[^\n:：]*)?[:\s：]?\s*(\d{4})\s*년\s+(\d{1,2})\s*월\s+(\d{1,2})\s*일/,
  )
  const meetingNoFromText = meetingDateMatch?.[2] ? Number(meetingDateMatch[2]) : undefined
  const baseMeetingDate = meetingDateMatch
    ? new Date(
        `${meetingDateMatch[3]}-${meetingDateMatch[4].padStart(2, '0')}-${meetingDateMatch[5].padStart(2, '0')}T00:00:00Z`,
      )
    : // Fallback: try simpler date pattern
      (() => {
        const simpleDate = text.match(/(\d{4})년\s+(\d{1,2})월\s+(\d{1,2})일/)
        return simpleDate
          ? new Date(
              `${simpleDate[1]}-${simpleDate[2].padStart(2, '0')}-${simpleDate[3].padStart(2, '0')}T00:00:00Z`,
            )
          : new Date()
      })()

  // Extract 차수 (meeting round number) from text: "제N차"
  const meetingNoFallback = (() => {
    const m = text.match(/제\s*(\d+)\s*차/)
    return m ? Number(m[1]) : undefined
  })()

  const meetingNo = metadata?.meetingNo ?? meetingNoFromText ?? meetingNoFallback

  // Determine ruling from first page text
  let ruling = '미상'
  const rulingSection = text.slice(0, 2000)
  if (/급여의\s+적정성이\s+있음|급여\s+적정|급여대상|등재/.test(rulingSection)) ruling = '급여'
  else if (/급여의\s+적정성이\s+없음|급여\s+비적정|비급여|부결/.test(rulingSection)) ruling = '비급여'
  else if (/보류|재검토|연기/.test(rulingSection)) ruling = '보류'
  else if (/급여/.test(rulingSection)) ruling = '급여'

  // Extract ingredient/drug from top of PDF if not in metadata
  // First line usually: "<ingredient> <strength>"
  // or second line: "(제품명, 회사)"
  let ingredient = metadata?.ingredient
  let drug = metadata?.drug

  if (!ingredient) {
    // PDF often starts with: "약제 요양급여의 적정성 평가결과\n<ingredient> <strength>\n(<drug>, <company>)"
    const ingredientMatch = text.match(/평가결과\s*\n+\s*([^\n()（）]{5,200})\s*\n/)
    if (ingredientMatch) ingredient = ingredientMatch[1].trim().slice(0, 200)
  }

  if (!drug) {
    const drugMatch = text.match(/\(([^,()]{3,100}),\s*[^)]+\)/)
    if (drugMatch) drug = drugMatch[1].trim().slice(0, 200)
  }

  // Rationale: extract 가. 평가 결과 section (first 2000 chars of rationale section)
  let rationale: string | undefined
  const rationaleSection = text.match(/가\.\s*평가\s*결과([\s\S]{50,3000})나\.\s*평가\s*내용/)
  if (rationaleSection) {
    rationale = rationaleSection[1].replace(/\s+/g, ' ').trim().slice(0, 1500)
  } else {
    // Fallback: grab substantial text block
    const lines = text.split('\n').filter((l) => l.trim().length > 20)
    rationale = lines.slice(2, 8).join(' ').trim().slice(0, 1500)
  }

  // Agenda: use ingredient as title-level agenda
  const agenda = ingredient
    ? `${ingredient} 급여 평가 (${body === 'dbc' ? '약평위' : '암질심'})`
    : '약제 급여 평가'

  const decision: ParsedHiraDecision = {
    body,
    meetingDate: baseMeetingDate,
    meetingNo,
    agendaNo: metadata?.agendaNo ?? 0,
    agenda: agenda.slice(0, 500),
    drug,
    ingredient,
    ruling,
    rationale,
    sourceUrl,
    sourceHash,
    rawData: {
      pdfTextExcerpt: text.slice(0, 2000),
      pages: result.pages?.length,
    },
  }

  return [decision]
}

// ─── HiraSource ──────────────────────────────────────────────────────────────

export class HiraSource extends SourcePlugin {
  name = 'hira'
  region = 'KR' as Region

  /** Stub — not used for HIRA (HTML-based, not JSON list) */
  async fetch(): Promise<unknown[]> {
    return []
  }

  /** Stub — not used for HIRA */
  async parse(): Promise<unknown[]> {
    return []
  }

  // ── Listing ─────────────────────────────────────────────────────────────────

  async fetchListingHtml(body: HiraBody, page = 1): Promise<string> {
    const pgmid = PGMID[body]
    const url = `${HIRA_BASE}/bbsDummy.do?pgmid=${pgmid}&pageIndex=${page}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`HIRA listing fetch failed: ${res.status} ${url}`)
    return res.text()
  }

  async fetchListingPage(body: HiraBody, page = 1): Promise<{ rows: HiraListingRow[]; html: string }> {
    const html = await this.fetchListingHtml(body, page)
    const rows = parseListingHtml(html, body)
    return { rows, html }
  }

  // ── Detail ──────────────────────────────────────────────────────────────────

  async fetchDetailHtml(body: HiraBody, brdBltNo: string): Promise<string> {
    const pgmid = PGMID[body]
    const url = `${HIRA_BASE}/bbsDummy.do?pgmid=${pgmid}&brdScnBltNo=4&brdBltNo=${brdBltNo}&pageIndex=1&pageIndex2=1`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`HIRA detail fetch failed: ${res.status} ${url}`)
    return res.text()
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────

  buildDownloadUrl(opts: {
    body: HiraBody
    seq: string
    brdBltNo: string
    bbsTyNo?: string
    bbsBltNo?: string
  }): string {
    const bbsTyNo = opts.bbsTyNo ?? BBS_TY_NO[opts.body]
    const bbsBltNo = opts.bbsBltNo ?? '0'
    return (
      `${HIRA_BASE}/bbs/bbsCDownLoad.do` +
      `?apndNo=${opts.seq}` +
      `&apndBrdBltNo=${opts.brdBltNo}` +
      `&apndBrdTyNo=${bbsTyNo}` +
      `&apndBltNo=${bbsBltNo}`
    )
  }

  async fetchPdf(downloadUrl: string): Promise<{ buffer: Buffer; isPdf: boolean }> {
    const res = await fetch(downloadUrl, { headers: HEADERS })
    if (!res.ok) throw new Error(`HIRA PDF fetch failed (${downloadUrl}): ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const isPdf = buffer.slice(0, 4).toString() === '%PDF'
    return { buffer, isPdf }
  }

  // ── Persist ──────────────────────────────────────────────────────────────────

  async persistDecision(
    parsed: ParsedHiraDecision,
  ): Promise<{ inserted: number; updated: number }> {
    const agendaNo = parsed.agendaNo ?? 0
    const existing = await prisma.hiraDecision
      .findUnique({
        where: { sourceHash_agendaNo: { sourceHash: parsed.sourceHash, agendaNo } },
      })
      .catch(() => null)

    await prisma.hiraDecision.upsert({
      where: { sourceHash_agendaNo: { sourceHash: parsed.sourceHash, agendaNo } },
      create: {
        body: parsed.body,
        meetingDate: parsed.meetingDate,
        meetingNo: parsed.meetingNo,
        agendaNo: parsed.agendaNo,
        agenda: parsed.agenda,
        drug: parsed.drug,
        ingredient: parsed.ingredient,
        ruling: parsed.ruling,
        rationale: parsed.rationale,
        sourceUrl: parsed.sourceUrl,
        sourceHash: parsed.sourceHash,
        rawData: parsed.rawData as object | undefined,
      },
      update: {
        agenda: parsed.agenda,
        drug: parsed.drug,
        ingredient: parsed.ingredient,
        ruling: parsed.ruling,
        rationale: parsed.rationale,
        rawData: parsed.rawData as object | undefined,
      },
    })

    return existing ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 }
  }

  // ── Main ingest ───────────────────────────────────────────────────────────────

  /**
   * Ingest recent decisions from HIRA listing.
   * Strategy: scrape listing rows (metadata), then fetch detail + download PDF
   * for each row to get rationale. Falls back gracefully if PDF parse fails.
   */
  async ingestRecent(body: HiraBody, maxRows = 10, maxPages = 2): Promise<IngestResult> {
    const start = Date.now()
    const errors: Array<{ id?: string; error: string }> = []
    let fetched = 0,
      inserted = 0,
      updated = 0

    try {
      const allRows: HiraListingRow[] = []

      for (let page = 1; page <= maxPages && allRows.length < maxRows; page++) {
        const { rows } = await this.fetchListingPage(body, page)
        allRows.push(...rows)
        if (rows.length < 10) break // last page
      }

      const rowsToProcess = allRows.slice(0, maxRows)
      fetched = rowsToProcess.length

      for (const row of rowsToProcess) {
        try {
          const pgmid = PGMID[body]
          const listingUrl = `${HIRA_BASE}/bbsDummy.do?pgmid=${pgmid}&brdScnBltNo=4&brdBltNo=${row.brdBltNo}&pageIndex=1&pageIndex2=1`

          let decisions: ParsedHiraDecision[] = []

          // Try to get detail page + PDF
          try {
            const detailHtml = await this.fetchDetailHtml(body, row.brdBltNo)
            const detail = parseDetailHtml(detailHtml)

            // Find 평가결과 PDF (seq for file named "평가결과_...")
            const pdfFile = detail.files.find(
              (f) =>
                f.name.includes('평가결과') ||
                f.name.toLowerCase().endsWith('.pdf') ||
                f.name.includes('공고전문'),
            )

            if (pdfFile && detail.bbsBltNo) {
              const dlUrl = this.buildDownloadUrl({
                body,
                seq: pdfFile.seq,
                brdBltNo: row.brdBltNo,
                bbsTyNo: detail.bbsTyNo,
                bbsBltNo: detail.bbsBltNo,
              })

              const { buffer, isPdf } = await this.fetchPdf(dlUrl)

              if (isPdf) {
                // Parse meeting round from listing row
                let meetingNo: number | undefined
                if (row.meetingRound) {
                  const m = row.meetingRound.match(/제\s*(\d+)\s*차/)
                  if (m) meetingNo = Number(m[1])
                }

                decisions = await parseHiraDecisionsFromPdf(buffer, body, dlUrl, {
                  drug: row.drug,
                  ingredient: row.ingredient,
                  meetingNo,
                })
              }
            }
          } catch (detailErr) {
            // PDF fetch failed — fall back to listing-only metadata
          }

          // If PDF parse didn't yield, create a listing-only decision
          if (decisions.length === 0) {
            const meetingDateStr = parseMeetingRoundToDate(row.meetingRound)
            const meetingNo = (() => {
              const m = row.meetingRound?.match(/제\s*(\d+)\s*차/)
              return m ? Number(m[1]) : undefined
            })()

            // Use listing URL hash as source hash
            const sourceHash = createHash('sha256').update(listingUrl + row.brdBltNo).digest('hex')
            decisions = [
              {
                body,
                meetingDate: meetingDateStr,
                meetingNo,
                agendaNo: parseInt(row.brdBltNo, 10) % 10000,
                agenda: row.ingredient
                  ? `${row.ingredient} 급여 평가 (${body === 'dbc' ? '약평위' : '암질심'})`
                  : '약제 급여 평가',
                drug: row.drug,
                ingredient: row.ingredient,
                ruling: row.ruling ?? '미상',
                rationale: undefined,
                sourceUrl: listingUrl,
                sourceHash,
                rawData: { meetingRound: row.meetingRound, company: row.company },
              },
            ]
          }

          for (const d of decisions) {
            const r = await this.persistDecision(d)
            inserted += r.inserted
            updated += r.updated
          }
        } catch (e) {
          errors.push({
            id: row.brdBltNo,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
    } catch (e) {
      errors.push({ error: `listing fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    }

    return {
      source: `hira/${body}`,
      fetched,
      inserted,
      updated,
      errors,
      durationMs: Date.now() - start,
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert meeting round string like "2025년 제11차" to approximate Date.
 * We guess month by round number (each round ~1 month apart).
 */
function parseMeetingRoundToDate(meetingRound?: string): Date {
  if (!meetingRound) return new Date()

  // "2025년 제11차" → year=2025, round=11
  const yearMatch = meetingRound.match(/(\d{4})년/)
  const roundMatch = meetingRound.match(/제\s*(\d+)\s*차/)

  if (yearMatch && roundMatch) {
    const year = parseInt(yearMatch[1], 10)
    const round = parseInt(roundMatch[1], 10)
    // Approximate: first meeting ~January, each meeting ~every month
    const month = Math.min(round, 12)
    return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`)
  }

  if (yearMatch) {
    return new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
  }

  return new Date()
}
