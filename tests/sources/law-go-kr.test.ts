import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  parseLawSearchItem,
  parseLawArticle,
  parseExpcSearchItem,
  parseExpcDetail,
  parseAdmrulSearchItem,
  parseAdmrulDetail,
  parseYyyymmdd,
  LawGoKrSource,
} from '@/lib/sources/law-go-kr'
import { prisma } from '@/lib/db'

// ─── Load fixtures ─────────────────────────────────────────────────────────

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `tests/fixtures/law/${name}`), 'utf-8'),
  )
}

const lawSearchFixture = loadFixture('search-pharm-act.json') as {
  LawSearch: { law: Record<string, unknown>[]; totalCnt: number | string }
}
const lawDetailFixture = loadFixture('detail-pharm-act-MST279725.json') as {
  법령: {
    기본정보: Record<string, unknown>
    조문: { 조문단위: Record<string, unknown>[] }
  }
}
const expcSearchFixture = loadFixture('search-expc-pharm-act.json') as {
  Expc: { expc: Record<string, unknown>[]; totalCnt: number | string }
}
const expcDetailFixture = loadFixture('detail-expc-314666.json') as Record<string, unknown>
const admrulSearchFixture = loadFixture('search-admrul-uipum.json') as {
  AdmRulSearch: { admrul: Record<string, unknown>[]; totalCnt: number | string }
}
const admrulDetailFixture = loadFixture('detail-admrul-2100000057429.json') as Record<
  string,
  unknown
>

// ─── parseYyyymmdd ─────────────────────────────────────────────────────────

describe('parseYyyymmdd', () => {
  it('parses YYYYMMDD string to UTC Date', () => {
    const d = parseYyyymmdd('20260412')
    expect(d).toBeInstanceOf(Date)
    expect(d!.toISOString()).toBe('2026-04-12T00:00:00.000Z')
  })

  it('parses YYYY.MM.DD format (expc 회신일자 style)', () => {
    const d = parseYyyymmdd('2014.06.09')
    expect(d).toBeInstanceOf(Date)
    expect(d!.toISOString()).toBe('2014-06-09T00:00:00.000Z')
  })

  it('returns undefined for non-string input', () => {
    expect(parseYyyymmdd(null)).toBeUndefined()
    expect(parseYyyymmdd(undefined)).toBeUndefined()
    expect(parseYyyymmdd(20261112)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(parseYyyymmdd('')).toBeUndefined()
  })
})

// ─── parseLawSearchItem ────────────────────────────────────────────────────

describe('parseLawSearchItem', () => {
  it('parses 약사법(법률) from fixture — MST 279725', () => {
    const items = lawSearchFixture.LawSearch.law
    const pharmAct = items.find(
      (x) => x['법령명한글'] === '약사법' && x['법령구분명'] === '법률',
    )!
    expect(pharmAct).toBeDefined()
    const parsed = parseLawSearchItem(pharmAct)
    expect(parsed.mst).toBe('279725')
    expect(parsed.lawId).toBe('001783')
    expect(parsed.nameKor).toBe('약사법')
    expect(parsed.category).toBe('법률')
    expect(parsed.agencyName).toBe('보건복지부,식품의약품안전처')
    expect(parsed.effectiveDate).toBeInstanceOf(Date)
    expect(parsed.promulgationDate).toBeInstanceOf(Date)
    expect(parsed.rawData).toBe(pharmAct)
  })

  it('maps optional fields correctly', () => {
    const items = lawSearchFixture.LawSearch.law
    const item = items[0]
    const parsed = parseLawSearchItem(item)
    expect(typeof parsed.mst).toBe('string')
    expect(parsed.mst.length).toBeGreaterThan(0)
    // shortName is empty string → should be undefined
    if (item['법령약칭명'] === '') {
      expect(parsed.shortName).toBeUndefined()
    }
    // agencyCode from 소관부처코드
    if (item['소관부처코드'] && item['소관부처코드'] !== '') {
      expect(parsed.agencyCode).toBeTruthy()
    }
  })

  it('throws on missing required field', () => {
    expect(() => parseLawSearchItem({ 법령ID: '001', 법령명한글: '테스트', 법령구분명: '법률', 소관부처명: '부처' })).toThrow(
      '법령일련번호',
    )
  })
})

// ─── parseLawArticle ───────────────────────────────────────────────────────

describe('parseLawArticle', () => {
  it('parses an article with title (조문여부=조문)', () => {
    const articles = lawDetailFixture.법령.조문.조문단위
    // Find first article with 조문제목
    const withTitle = articles.find((a) => a['조문제목'])!
    expect(withTitle).toBeDefined()
    const parsed = parseLawArticle(withTitle)
    expect(parsed.articleNo).toBe(String(withTitle['조문번호']))
    expect(parsed.title).toBeTruthy()
    expect(parsed.body).toBeTruthy()
    expect(parsed.effectiveDate).toBeInstanceOf(Date)
  })

  it('parses a chapter header (조문여부=전문) with no title', () => {
    const articles = lawDetailFixture.법령.조문.조문단위
    const header = articles.find((a) => a['조문여부'] === '전문')!
    expect(header).toBeDefined()
    const parsed = parseLawArticle(header)
    expect(parsed.title).toBeUndefined()
    expect(parsed.changedFlag).toBe(false) // '전문' articles show N
  })

  it('sets changedFlag=false when 조문변경여부=N', () => {
    const parsed = parseLawArticle({
      조문번호: '1',
      조문내용: '내용',
      조문변경여부: 'N',
      조문시행일자: '20260101',
    })
    expect(parsed.changedFlag).toBe(false)
  })
})

// ─── parseExpcSearchItem ───────────────────────────────────────────────────

describe('parseExpcSearchItem', () => {
  it('parses first expc search item from fixture', () => {
    const items = expcSearchFixture.Expc.expc
    const item = items[0]
    const parsed = parseExpcSearchItem(item)
    expect(parsed.ipNo).toBe('314666')
    expect(parsed.caseNo).toBe('14-0247')
    expect(parsed.title).toContain('강화군')
    expect(parsed.respondent).toBe('법제처')
    expect(parsed.rawData).toBe(item)
  })

  it('throws on missing 안건명', () => {
    expect(() =>
      parseExpcSearchItem({ 법령해석례일련번호: '123', 회신기관명: '법제처' }),
    ).toThrow('안건명')
  })
})

// ─── parseExpcDetail ───────────────────────────────────────────────────────

describe('parseExpcDetail', () => {
  it('extracts body (회답 + 이유), respondent, date from ExpcService fixture', () => {
    const parsed = parseExpcDetail(expcDetailFixture)
    expect(parsed.body).toContain('수의사') // from 회답 or 이유
    expect(parsed.respondent).toBe('법제처')
    expect(parsed.responseDate).toBeInstanceOf(Date)
    expect(parsed.responseDate!.toISOString()).toBe('2014-06-09T00:00:00.000Z')
    expect(parsed.caseNo).toBe('14-0247')
    expect(parsed.inquirer).toBe('인천광역시 강화군')
  })
})

// ─── parseAdmrulSearchItem ─────────────────────────────────────────────────

describe('parseAdmrulSearchItem', () => {
  it('parses first admrul search item from fixture', () => {
    const items = admrulSearchFixture.AdmRulSearch.admrul
    const item = items[0]
    const parsed = parseAdmrulSearchItem(item)
    expect(parsed.arNo).toBe('2100000057429')
    expect(parsed.name).toBe('가족계획용 의약품의 지정')
    expect(parsed.agencyName).toBe('보건복지부')
    expect(parsed.ruleType).toBe('고시')
    expect(parsed.promulgationDate).toBeInstanceOf(Date)
    expect(parsed.promulgationDate!.toISOString()).toBe('2016-08-24T00:00:00.000Z')
    expect(parsed.amendmentCode).toBe('200403')
    expect(parsed.rawData).toBe(item)
  })

  it('throws on missing 행정규칙명', () => {
    expect(() =>
      parseAdmrulSearchItem({ 행정규칙일련번호: '123', 소관부처명: '부처', 행정규칙종류: '고시' }),
    ).toThrow('행정규칙명')
  })
})

// ─── parseAdmrulDetail ─────────────────────────────────────────────────────

describe('parseAdmrulDetail', () => {
  it('extracts body from 조문내용 array in AdmRulService', () => {
    const parsed = parseAdmrulDetail(admrulDetailFixture)
    // 조문내용 is an array in the fixture
    expect(parsed.body).toBeDefined()
    expect(typeof parsed.body).toBe('string')
    expect((parsed.body ?? '').length).toBeGreaterThan(10)
  })
})

// ─── LawGoKrSource URL building (mocked fetch) ────────────────────────────

describe('LawGoKrSource URL building', () => {
  const OC = 'testoc'
  const BASE = 'https://mock.law.test'
  let src: LawGoKrSource

  beforeEach(() => {
    src = new LawGoKrSource({ oc: OC, baseUrl: BASE })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchLawSearch builds correct URL with encoded query', async () => {
    const mockRes = { ok: true, json: async () => ({ LawSearch: { law: [], totalCnt: 0 } }) }
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockRes as unknown as Response)
    await src.fetchLawSearch('약사법', 10)
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/lawSearch.do?OC=${OC}&target=law&type=JSON&query=%EC%95%BD%EC%82%AC%EB%B2%95&display=10&page=1`,
    )
  })

  it('fetchLawDetail builds correct MST URL', async () => {
    const mockDetail = {
      법령: {
        기본정보: {},
        조문: { 조문단위: [] },
      },
    }
    const mockRes = { ok: true, json: async () => mockDetail }
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockRes as unknown as Response)
    await src.fetchLawDetail('279725')
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/lawService.do?OC=${OC}&target=law&MST=279725&type=JSON`,
    )
  })

  it('fetchExpcSearch builds correct URL with target=expc', async () => {
    const mockRes = { ok: true, json: async () => ({ Expc: { expc: [], totalCnt: 0 } }) }
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockRes as unknown as Response)
    await src.fetchExpcSearch('의약품', 5)
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/lawSearch.do?OC=${OC}&target=expc&type=JSON&query=%EC%9D%98%EC%95%BD%ED%92%88&display=5&page=1`,
    )
  })

  it('fetchAdmrulSearch builds correct URL with target=admrul', async () => {
    const mockRes = {
      ok: true,
      json: async () => ({ AdmRulSearch: { admrul: [], totalCnt: 0 } }),
    }
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockRes as unknown as Response)
    await src.fetchAdmrulSearch('임상시험', 20)
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/lawSearch.do?OC=${OC}&target=admrul&type=JSON&query=%EC%9E%84%EC%83%81%EC%8B%9C%ED%97%98&display=20&page=1`,
    )
  })

  it('throws on HTTP error for law search', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response)
    await expect(src.fetchLawSearch('테스트')).rejects.toThrow('503')
  })
})

// ─── LawGoKrSource persist (real DB) ─────────────────────────────────────

const TEST_LAW_PREFIX = 'TEST_LAW_'
const TEST_EXPC_PREFIX = 'TEST_EXPC_'
const TEST_ADMRUL_PREFIX = 'TEST_ADMRUL_'

async function cleanupTestData() {
  const laws = await prisma.law.findMany({
    where: { mst: { startsWith: TEST_LAW_PREFIX } },
    select: { id: true },
  })
  if (laws.length > 0) {
    const ids = laws.map((l) => l.id)
    await prisma.lawArticle.deleteMany({ where: { lawId: { in: ids } } })
    await prisma.law.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.legalInterpretation.deleteMany({
    where: { ipNo: { startsWith: TEST_EXPC_PREFIX } },
  })
  await prisma.adminRule.deleteMany({
    where: { arNo: { startsWith: TEST_ADMRUL_PREFIX } },
  })
}

describe('LawGoKrSource persist (real DB)', () => {
  const src = new LawGoKrSource({ oc: 'testoc' })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it('persistLaw inserts Law + LawArticles and returns inserted=1', async () => {
    const parsed = {
      mst: `${TEST_LAW_PREFIX}001`,
      lawId: 'T001',
      nameKor: '테스트법',
      category: '법률',
      agencyName: '테스트부처',
      rawData: { test: true } as Record<string, unknown>,
    }
    const articles = [
      {
        articleNo: '1',
        title: '목적',
        body: '이 법은 테스트를 목적으로 한다.',
        changedFlag: false,
        rawData: {} as Record<string, unknown>,
      },
      {
        articleNo: '2',
        body: '이 법의 적용범위는 전국이다.',
        changedFlag: false,
        rawData: {} as Record<string, unknown>,
      },
    ]
    const result = await src.persistLaw(parsed, articles)
    expect(result.inserted).toBe(1)
    expect(result.updated).toBe(0)

    const law = await prisma.law.findUnique({ where: { mst: parsed.mst }, include: { articles: true } })
    expect(law).not.toBeNull()
    expect(law!.nameKor).toBe('테스트법')
    expect(law!.articles).toHaveLength(2)
    expect(law!.articles[0].title).toBe('목적')
  })

  it('persistLaw updates on second call and returns updated=1', async () => {
    const parsed = {
      mst: `${TEST_LAW_PREFIX}002`,
      lawId: 'T002',
      nameKor: '테스트법2',
      category: '대통령령',
      agencyName: '부처',
      rawData: {} as Record<string, unknown>,
    }
    await src.persistLaw(parsed, [])
    const result2 = await src.persistLaw({ ...parsed, nameKor: '테스트법2_개정' }, [])
    expect(result2.inserted).toBe(0)
    expect(result2.updated).toBe(1)

    const law = await prisma.law.findUnique({ where: { mst: parsed.mst } })
    expect(law!.nameKor).toBe('테스트법2_개정')
  })

  it('persistExpc inserts LegalInterpretation and returns inserted=1', async () => {
    const parsed = {
      ipNo: `${TEST_EXPC_PREFIX}001`,
      caseNo: 'TEST-0001',
      title: '테스트 행정해석',
      respondent: '법제처',
      body: '이 해석에 따르면 테스트는 허용됩니다.',
      rawData: {} as Record<string, unknown>,
    }
    const result = await src.persistExpc(parsed)
    expect(result.inserted).toBe(1)
    expect(result.updated).toBe(0)

    const record = await prisma.legalInterpretation.findUnique({ where: { ipNo: parsed.ipNo } })
    expect(record).not.toBeNull()
    expect(record!.title).toBe('테스트 행정해석')
    expect(record!.body).toContain('허용')
  })

  it('persistAdmrul inserts AdminRule and returns inserted=1', async () => {
    const parsed = {
      arNo: `${TEST_ADMRUL_PREFIX}001`,
      name: '테스트 고시',
      agencyName: '식품의약품안전처',
      ruleType: '고시',
      amendmentCode: '200403',
      rawData: {} as Record<string, unknown>,
    }
    const result = await src.persistAdmrul(parsed)
    expect(result.inserted).toBe(1)
    expect(result.updated).toBe(0)

    const record = await prisma.adminRule.findUnique({ where: { arNo: parsed.arNo } })
    expect(record).not.toBeNull()
    expect(record!.name).toBe('테스트 고시')
    expect(record!.ruleType).toBe('고시')
  })
})
