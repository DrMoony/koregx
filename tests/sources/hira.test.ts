import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  parseListingHtml,
  parseDetailHtml,
  parseHiraDecisionsFromPdf,
  HiraSource,
  type HiraBody,
} from '@/lib/sources/hira'
import { prisma } from '@/lib/db'

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fixtureExists(name: string) {
  return existsSync(resolve(process.cwd(), `tests/fixtures/hira/${name}`))
}

function loadHtmlFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), `tests/fixtures/hira/${name}`), 'utf-8')
}

function loadPdfFixture(name: string): Buffer {
  return readFileSync(resolve(process.cwd(), `tests/fixtures/hira/${name}`))
}

// ─── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  prisma: {
    hiraDecision: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))

// ─── parseListingHtml (DBC) ──────────────────────────────────────────────────

describe('parseListingHtml — dbc', () => {
  it('extracts board rows from DBC listing page fixture', () => {
    if (!fixtureExists('dbc-listing-p1.html')) return // skip if no fixture

    const html = loadHtmlFixture('dbc-listing-p1.html')
    const rows = parseListingHtml(html, 'dbc')

    expect(rows.length).toBeGreaterThan(0)
    const first = rows[0]
    expect(first.brdBltNo).toMatch(/^\d+$/)
    expect(first.meetingRound).toMatch(/\d{4}년 제\d+차/)
    expect(first.ingredient).toBeTruthy()
  })

  it('extracts ruling from DBC row', () => {
    if (!fixtureExists('dbc-listing-p1.html')) return

    const html = loadHtmlFixture('dbc-listing-p1.html')
    const rows = parseListingHtml(html, 'dbc')

    // At least some rows should have a ruling
    const rowsWithRuling = rows.filter((r) => r.ruling)
    expect(rowsWithRuling.length).toBeGreaterThan(0)
    // Ruling should be one of known values (spaces may or may not be present)
    const knownRulings = ['급여', '비급여', '보류', '조건부 급여', '조건부급여', '제조', '미상']
    for (const row of rowsWithRuling) {
      expect(knownRulings).toContain(row.ruling?.trim())
    }
  })

  it('handles minimal HTML with no rows gracefully', () => {
    const html = '<html><body><p>no table here</p></body></html>'
    const rows = parseListingHtml(html, 'dbc')
    expect(rows).toEqual([])
  })

  it('extracts rows from cancer listing page fixture', () => {
    if (!fixtureExists('cancer-listing-p1.html')) return

    const html = loadHtmlFixture('cancer-listing-p1.html')
    const rows = parseListingHtml(html, 'cancer')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].brdBltNo).toMatch(/^\d+$/)
  })
})

// ─── parseDetailHtml ──────────────────────────────────────────────────────────

describe('parseDetailHtml', () => {
  it('extracts title, date, and files from DBC detail fixture', () => {
    if (!fixtureExists('dbc-detail-47085.html')) return

    const html = loadHtmlFixture('dbc-detail-47085.html')
    const detail = parseDetailHtml(html)

    expect(detail.title).toContain('tremelimumab')
    expect(detail.postedDate).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(detail.files.length).toBeGreaterThan(0)
    // Should have bbsBltNo parsed from download calls
    expect(detail.bbsBltNo).toBeTruthy()
    // Files should have seq + name
    expect(detail.files[0].seq).toMatch(/^\d+$/)
    expect(detail.files[0].name).toBeTruthy()
  })

  it('handles HTML with no files gracefully', () => {
    const html = '<html><body><div class="title">Test</div></body></html>'
    const detail = parseDetailHtml(html)
    expect(detail.files).toEqual([])
  })
})

// ─── parseHiraDecisionsFromPdf ────────────────────────────────────────────────

describe('parseHiraDecisionsFromPdf', () => {
  it('extracts at least 1 decision from DBC PDF fixture', async () => {
    if (!fixtureExists('dbc-47085-tremelimumab.pdf')) return

    const buf = loadPdfFixture('dbc-47085-tremelimumab.pdf')
    const decisions = await parseHiraDecisionsFromPdf(buf, 'dbc', 'https://example.com/test.pdf')

    expect(decisions.length).toBeGreaterThan(0)
    const d = decisions[0]
    expect(d.body).toBe('dbc')
    expect(d.sourceHash).toHaveLength(64) // sha256 hex
    expect(d.ruling).toBeTruthy()
    expect(d.meetingDate).toBeInstanceOf(Date)
  })

  it('detects ruling keyword 급여 from DBC PDF', async () => {
    if (!fixtureExists('dbc-47085-tremelimumab.pdf')) return

    const buf = loadPdfFixture('dbc-47085-tremelimumab.pdf')
    const decisions = await parseHiraDecisionsFromPdf(buf, 'dbc', 'https://example.com/test.pdf')

    // tremelimumab was approved (급여)
    expect(decisions[0].ruling).toBe('급여')
  })

  it('extracts meeting date from DBC PDF text', async () => {
    if (!fixtureExists('dbc-47085-tremelimumab.pdf')) return

    const buf = loadPdfFixture('dbc-47085-tremelimumab.pdf')
    const decisions = await parseHiraDecisionsFromPdf(buf, 'dbc', 'https://example.com/test.pdf')

    const d = decisions[0]
    // Meeting date should be in 2025 based on PDF content (제9차 or 제11차)
    expect(d.meetingDate.getFullYear()).toBe(2025)
  })

  it('accepts metadata override for drug/ingredient', async () => {
    if (!fixtureExists('dbc-47085-tremelimumab.pdf')) return

    const buf = loadPdfFixture('dbc-47085-tremelimumab.pdf')
    const decisions = await parseHiraDecisionsFromPdf(buf, 'dbc', 'https://example.com/test.pdf', {
      ingredient: 'tremelimumab 0.3g',
      drug: '이뮤도주',
      meetingNo: 11,
    })

    expect(decisions[0].ingredient).toBe('tremelimumab 0.3g')
    expect(decisions[0].drug).toBe('이뮤도주')
    expect(decisions[0].meetingNo).toBe(11)
  })

  it('extracts rationale from PDF text', async () => {
    if (!fixtureExists('dbc-47085-tremelimumab.pdf')) return

    const buf = loadPdfFixture('dbc-47085-tremelimumab.pdf')
    const decisions = await parseHiraDecisionsFromPdf(buf, 'dbc', 'https://example.com/test.pdf')

    expect(decisions[0].rationale).toBeTruthy()
    expect(typeof decisions[0].rationale).toBe('string')
    expect(decisions[0].rationale!.length).toBeGreaterThan(20)
  })
})

// ─── persistDecision ─────────────────────────────────────────────────────────

describe('HiraSource.persistDecision', () => {
  beforeEach(() => {
    vi.mocked(prisma.hiraDecision.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.hiraDecision.upsert).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns inserted=1 when record is new', async () => {
    const src = new HiraSource()
    const r = await src.persistDecision({
      body: 'dbc',
      meetingDate: new Date('2025-11-06T00:00:00Z'),
      meetingNo: 11,
      agendaNo: 1,
      agenda: 'tremelimumab test',
      drug: '이뮤도주',
      ingredient: 'tremelimumab',
      ruling: '급여',
      rationale: 'test rationale',
      sourceUrl: 'https://example.com/test.pdf',
      sourceHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    })

    expect(r.inserted).toBe(1)
    expect(r.updated).toBe(0)
    expect(prisma.hiraDecision.upsert).toHaveBeenCalledOnce()
  })

  it('returns updated=1 when record already exists', async () => {
    vi.mocked(prisma.hiraDecision.findUnique).mockResolvedValue({
      id: 'existing-id',
    } as never)

    const src = new HiraSource()
    const r = await src.persistDecision({
      body: 'dbc',
      meetingDate: new Date('2025-11-06T00:00:00Z'),
      agendaNo: 1,
      agenda: 'tremelimumab test',
      ruling: '급여',
      sourceUrl: 'https://example.com/test.pdf',
      sourceHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    })

    expect(r.inserted).toBe(0)
    expect(r.updated).toBe(1)
  })
})

// ─── fetchListingPage (mocked fetch) ─────────────────────────────────────────

describe('HiraSource.fetchListingPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts rows from mocked listing HTML', async () => {
    // Minimal listing HTML with one DBC row
    const mockHtml = `
      <table>
        <thead><tr><th>회차</th><th>성분명</th><th>제품명</th><th>업소명</th><th>평가결과</th></tr></thead>
        <tbody>
          <tr>
            <td class="col-num2">2025년 제11차</td>
            <td class="col-tit"><a href="?pgmid=HIRAA030014040000&brdScnBltNo=4&brdBltNo=47085&pageIndex=1&pageIndex2=1">testomab 0.3g</a></td>
            <td class="col-depart">테스트주(테스토맙)</td>
            <td class="col-depart">테스트제약</td>
            <td class="col-depart">급여</td>
          </tr>
        </tbody>
      </table>
    `

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as Response)

    const src = new HiraSource()
    const { rows } = await src.fetchListingPage('dbc', 1)

    expect(rows).toHaveLength(1)
    expect(rows[0].brdBltNo).toBe('47085')
    expect(rows[0].meetingRound).toBe('2025년 제11차')
    expect(rows[0].ingredient).toBe('testomab 0.3g')
    expect(rows[0].ruling).toBe('급여')
  })

  it('throws when listing fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const src = new HiraSource()
    await expect(src.fetchListingPage('dbc', 1)).rejects.toThrow('HIRA listing fetch failed: 500')
  })
})

// ─── buildDownloadUrl ─────────────────────────────────────────────────────────

describe('HiraSource.buildDownloadUrl', () => {
  it('builds correct download URL', () => {
    const src = new HiraSource()
    const url = src.buildDownloadUrl({
      body: 'dbc',
      seq: '2',
      brdBltNo: '47085',
      bbsTyNo: '17',
      bbsBltNo: '58',
    })
    expect(url).toBe(
      'https://www.hira.or.kr/bbs/bbsCDownLoad.do?apndNo=2&apndBrdBltNo=47085&apndBrdTyNo=17&apndBltNo=58',
    )
  })

  it('uses default bbsTyNo when not provided', () => {
    const src = new HiraSource()
    const url = src.buildDownloadUrl({
      body: 'dbc',
      seq: '1',
      brdBltNo: '47085',
      bbsBltNo: '58',
    })
    expect(url).toContain('apndBrdTyNo=17')
  })

  it('uses cancer bbsTyNo=6 for cancer body', () => {
    const src = new HiraSource()
    const url = src.buildDownloadUrl({
      body: 'cancer',
      seq: '1',
      brdBltNo: '45655',
      bbsBltNo: '49',
    })
    expect(url).toContain('apndBrdTyNo=6')
  })
})

// ─── ingestRecent integration (fully mocked) ──────────────────────────────────

describe('HiraSource.ingestRecent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('returns fetched/inserted counts with mocked listing + no detail', async () => {
    const mockListingHtml = `
      <table>
        <tbody>
          <tr>
            <td class="col-num2">2025년 제11차</td>
            <td class="col-tit"><a href="?pgmid=HIRAA030014040000&brdScnBltNo=4&brdBltNo=47085&pageIndex=1&pageIndex2=1">testomab 0.3g</a></td>
            <td class="col-depart">테스트주</td>
            <td class="col-depart">테스트제약</td>
            <td class="col-depart">급여</td>
          </tr>
          <tr>
            <td class="col-num2">2025년 제11차</td>
            <td class="col-tit"><a href="?pgmid=HIRAA030014040000&brdScnBltNo=4&brdBltNo=47084&pageIndex=1&pageIndex2=1">somabib 1mg</a></td>
            <td class="col-depart">소마비주</td>
            <td class="col-depart">제약사</td>
            <td class="col-depart">비급여</td>
          </tr>
        </tbody>
      </table>
    `

    // Mock fetch: listing returns HTML, detail + PDF fetches fail (so fallback to listing-only)
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('pageIndex=1') && !url.includes('brdScnBltNo')) {
        return Promise.resolve({ ok: true, text: async () => mockListingHtml } as Response)
      }
      // Detail and PDF fail
      return Promise.resolve({ ok: false, status: 404 } as Response)
    })

    vi.mocked(prisma.hiraDecision.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.hiraDecision.upsert).mockResolvedValue({} as never)

    const src = new HiraSource()
    const result = await src.ingestRecent('dbc', 5, 1)

    expect(result.source).toBe('hira/dbc')
    expect(result.fetched).toBe(2)
    expect(result.inserted).toBe(2)
    expect(result.updated).toBe(0)
    // Errors from detail/PDF fetch failures are swallowed (fallback mode)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error in result if listing fetch completely fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    const src = new HiraSource()
    const result = await src.ingestRecent('dbc', 5, 1)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].error).toContain('listing fetch failed')
  })
})
