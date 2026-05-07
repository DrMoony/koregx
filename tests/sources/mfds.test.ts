import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MfdsSource, parseMfdsItem } from '@/lib/sources/mfds'
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
