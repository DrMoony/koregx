import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MfdsSource, parseMfdsItem } from '@/lib/sources/mfds'
import { prisma } from '@/lib/db'
import wegovyFixture from '../fixtures/mfds-search-wegovy.json'

const wegovyItems = (wegovyFixture as { body: { items: Record<string, unknown>[] } }).body.items

describe('parseMfdsItem', () => {
  it('maps 식약처 item to ParsedDrug shape', () => {
    const item = wegovyItems[0]
    const drug = parseMfdsItem(item)
    expect(drug.region).toBe('KR')
    expect(drug.itemSeq).toBe(item.ITEM_SEQ)
    expect(drug.productName).toBe(item.ITEM_NAME)
    expect(drug.rawData).toEqual(item)
  })

  it('uses MAIN_INGR_ENG as ingredient when present', () => {
    const item = wegovyItems[0]  // has MAIN_INGR_ENG="Semaglutide"
    const drug = parseMfdsItem(item)
    expect(drug.ingredient).toBe('Semaglutide')
  })

  it('falls back to INGR_NAME when MAIN_INGR_ENG empty', () => {
    const item = { ITEM_SEQ: 'X', ITEM_NAME: 'T', INGR_NAME: '한글성분' }
    const drug = parseMfdsItem(item)
    expect(drug.ingredient).toBe('한글성분')
  })

  it('trims trailing whitespace in manufacturer (ENTP_NAME)', () => {
    const item = { ITEM_SEQ: 'X', ITEM_NAME: 'T', ENTP_NAME: '노보노디스크제약(주) ' }
    const drug = parseMfdsItem(item)
    expect(drug.manufacturer).toBe('노보노디스크제약(주)')
  })

  it('handles missing optional fields gracefully', () => {
    const minimal = { ITEM_SEQ: '999', ITEM_NAME: '테스트정' }
    const drug = parseMfdsItem(minimal)
    expect(drug.productName).toBe('테스트정')
    expect(drug.itemSeq).toBe('999')
    expect(drug.ingredient).toBeUndefined()
    expect(drug.manufacturer).toBeUndefined()
    expect(drug.atc).toBeUndefined()
  })

  it('captures atc and category', () => {
    const item = {
      ITEM_SEQ: 'X',
      ITEM_NAME: 'T',
      ATC_CODE: 'A10BJ06',
      ETC_OTC_CODE: '전문의약품',
    }
    const drug = parseMfdsItem(item)
    expect(drug.atc).toBe('A10BJ06')
    expect(drug.category).toBe('전문의약품')
  })
})

describe('MfdsSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses correct endpoint + service key + URL params', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(wegovyFixture), { status: 200 })
    )
    const source = new MfdsSource({ serviceKey: 'test-key' })
    const items = await source.fetch({ query: '위고비', limit: 5 })

    expect(fetchSpy).toHaveBeenCalled()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06')
    expect(url).toContain('serviceKey=test-key')
    expect(url).toContain('item_name=')
    expect(url).toContain('type=json')
    expect(url).toContain('numOfRows=5')
    expect(items.length).toBe(5)
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('upstream error', { status: 500 }))
    const source = new MfdsSource({ serviceKey: 'test-key' })
    await expect(source.fetch({ query: 'X', limit: 1 })).rejects.toThrow(/MFDS fetch failed/)
  })

  it('handles "API not found" header (resultCode != "00")', async () => {
    const errorBody = { header: { resultCode: '99', resultMsg: 'API not found' }, body: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 200 }))
    const source = new MfdsSource({ serviceKey: 'test-key' })
    await expect(source.fetch({ query: 'X', limit: 1 })).rejects.toThrow(/MFDS API error/)
  })

  it('parse() returns ParsedDrug array (single item per raw)', async () => {
    const source = new MfdsSource({ serviceKey: 'test-key' })
    const parsed = await source.parse(wegovyItems[0])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].itemSeq).toBe(wegovyItems[0].ITEM_SEQ)
  })
})

describe('MfdsSource.persist', () => {
  beforeEach(async () => {
    if (process.env.NODE_ENV === 'production') throw new Error('persist test cannot run in production')
    // Clean test data only (TEST_ prefix)
    const testDrugs = await prisma.drug.findMany({ where: { itemSeq: { startsWith: 'TEST_' } }, select: { id: true } })
    if (testDrugs.length > 0) {
      const ids = testDrugs.map((d) => d.id)
      await prisma.approval.deleteMany({ where: { drugId: { in: ids } } })
      await prisma.drug.deleteMany({ where: { id: { in: ids } } })
    }
  })

  it('inserts Drug + Approval (KR/MFDS) on first persist', async () => {
    const parsed = [{
      region: 'KR' as const,
      itemSeq: 'TEST_001',
      productName: '테스트정',
      ingredient: '테스트성분',
      manufacturer: '테스트사',
      atc: 'A10BJ06',
      category: '전문의약품',
      rawData: { ITEM_SEQ: 'TEST_001', ITEM_NAME: '테스트정', ITEM_PERMIT_DATE: '20230101' },
    }]
    const source = new MfdsSource({ serviceKey: 'test' })
    const result = await source.persist(parsed)
    expect(result.inserted).toBe(1)
    expect(result.updated).toBe(0)

    const drug = await prisma.drug.findUnique({
      where: { itemSeq: 'TEST_001' },
      include: { approvals: true },
    })
    expect(drug).toBeTruthy()
    expect(drug?.productName).toBe('테스트정')
    expect(drug?.ingredient).toBe('테스트성분')
    expect(drug?.atc).toBe('A10BJ06')
    expect(drug?.approvals).toHaveLength(1)
    expect(drug?.approvals[0].region).toBe('KR')
    expect(drug?.approvals[0].authority).toBe('MFDS')
  })

  it('parses ITEM_PERMIT_DATE (YYYYMMDD) into Approval.approvalDate', async () => {
    const parsed = [{
      region: 'KR' as const,
      itemSeq: 'TEST_002',
      productName: '날짜테스트',
      rawData: { ITEM_SEQ: 'TEST_002', ITEM_NAME: '날짜테스트', ITEM_PERMIT_DATE: '20230427' },
    }]
    const source = new MfdsSource({ serviceKey: 'test' })
    await source.persist(parsed)

    const drug = await prisma.drug.findUnique({
      where: { itemSeq: 'TEST_002' },
      include: { approvals: true },
    })
    expect(drug?.approvals[0].approvalDate).toBeTruthy()
    expect(drug?.approvals[0].approvalDate?.toISOString().slice(0, 10)).toBe('2023-04-27')
  })

  it('updates existing Drug instead of duplicating', async () => {
    const source = new MfdsSource({ serviceKey: 'test' })
    const first = [{
      region: 'KR' as const,
      itemSeq: 'TEST_003',
      productName: '오리지날',
      rawData: { ITEM_SEQ: 'TEST_003' },
    }]
    const second = [{
      region: 'KR' as const,
      itemSeq: 'TEST_003',
      productName: '갱신된이름',
      rawData: { ITEM_SEQ: 'TEST_003' },
    }]
    await source.persist(first)
    const r = await source.persist(second)
    expect(r.updated).toBe(1)
    expect(r.inserted).toBe(0)

    const drug = await prisma.drug.findUnique({ where: { itemSeq: 'TEST_003' } })
    expect(drug?.productName).toBe('갱신된이름')
  })

  it('marks status withdrawn when CANCEL_DATE present', async () => {
    const parsed = [{
      region: 'KR' as const,
      itemSeq: 'TEST_004',
      productName: '취소테스트',
      rawData: { ITEM_SEQ: 'TEST_004', ITEM_NAME: '취소테스트', CANCEL_DATE: '20240101', CANCEL_NAME: '취소' },
    }]
    const source = new MfdsSource({ serviceKey: 'test' })
    await source.persist(parsed)

    const drug = await prisma.drug.findUnique({ where: { itemSeq: 'TEST_004' } })
    expect(drug?.status).toBe('withdrawn')
  })

  it('skips items without itemSeq (no natural key)', async () => {
    const parsed = [{
      region: 'KR' as const,
      productName: 'no key',
      rawData: {},
    }]
    const source = new MfdsSource({ serviceKey: 'test' })
    const r = await source.persist(parsed)
    expect(r.inserted).toBe(0)
    expect(r.updated).toBe(0)
  })
})
