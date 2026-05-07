import { SourcePlugin } from './base'
import type { Region } from '@/lib/types'

const MFDS_BASE_URL = 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07'
const MFDS_OPERATION = 'getDrugPrdtPrmsnDtlInq06'

export interface ParsedDrug {
  region: Region
  itemSeq?: string
  productName: string
  ingredient?: string
  manufacturer?: string
  atc?: string
  category?: string
  rawData: Record<string, unknown>
}

function trimOrUndefined(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

export function parseMfdsItem(item: Record<string, unknown>): ParsedDrug {
  const get = (k: string) => trimOrUndefined(item[k])
  return {
    region: 'KR',
    itemSeq: get('ITEM_SEQ'),
    productName: get('ITEM_NAME') ?? '(unknown)',
    ingredient: get('MAIN_INGR_ENG') ?? get('INGR_NAME'),
    manufacturer: get('ENTP_NAME'),
    atc: get('ATC_CODE'),
    category: get('ETC_OTC_CODE'),
    rawData: item,
  }
}

export interface MfdsFetchArgs {
  query: string
  limit?: number
}

interface MfdsResponse {
  header: { resultCode: string; resultMsg: string }
  body: { items?: unknown[] } | null
}

export class MfdsSource extends SourcePlugin {
  name = 'mfds'
  region = 'KR' as const
  serviceKey: string

  constructor(opts: { serviceKey: string }) {
    super()
    this.serviceKey = opts.serviceKey
  }

  async fetch(args: MfdsFetchArgs): Promise<unknown[]> {
    const params = new URLSearchParams({
      serviceKey: this.serviceKey,
      item_name: args.query,
      type: 'json',
      numOfRows: String(args.limit ?? 20),
      pageNo: '1',
    })
    const url = `${MFDS_BASE_URL}/${MFDS_OPERATION}?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`MFDS fetch failed: ${res.status}`)
    const json = (await res.json()) as MfdsResponse
    if (json.header?.resultCode && json.header.resultCode !== '00') {
      throw new Error(`MFDS API error (${json.header.resultCode}): ${json.header.resultMsg}`)
    }
    return json.body?.items ?? []
  }

  async parse(raw: unknown): Promise<ParsedDrug[]> {
    return [parseMfdsItem(raw as Record<string, unknown>)]
  }
}
