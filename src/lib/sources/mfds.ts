import { SourcePlugin } from './base'
import type { Region } from '@/lib/types'
import { prisma } from '@/lib/db'

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

  async persist(items: ParsedDrug[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0
    let updated = 0

    for (const item of items) {
      if (!item.itemSeq) continue // skip without natural key

      const raw = item.rawData as Record<string, unknown>
      const cancelDate =
        typeof raw.CANCEL_DATE === 'string' && raw.CANCEL_DATE.trim() !== ''
          ? raw.CANCEL_DATE.trim()
          : null
      const status = cancelDate ? 'withdrawn' : 'active'

      const existing = await prisma.drug.findUnique({ where: { itemSeq: item.itemSeq } })

      const drug = await prisma.drug.upsert({
        where: { itemSeq: item.itemSeq },
        create: {
          itemSeq: item.itemSeq,
          productName: item.productName,
          ingredient: item.ingredient,
          manufacturer: item.manufacturer,
          atc: item.atc,
          category: item.category,
          status,
          rawData: item.rawData as object,
        },
        update: {
          productName: item.productName,
          ingredient: item.ingredient,
          manufacturer: item.manufacturer,
          atc: item.atc,
          category: item.category,
          status,
          rawData: item.rawData as object,
          updatedAt: new Date(),
        },
      })

      if (existing) {
        updated++
      } else {
        inserted++
      }

      // Parse ITEM_PERMIT_DATE: YYYYMMDD → Date
      const permitStr = typeof raw.ITEM_PERMIT_DATE === 'string' ? raw.ITEM_PERMIT_DATE.trim() : ''
      const permitDate =
        permitStr.length === 8
          ? new Date(
              `${permitStr.slice(0, 4)}-${permitStr.slice(4, 6)}-${permitStr.slice(6, 8)}T00:00:00Z`
            )
          : null

      await prisma.approval.upsert({
        where: { drugId_region: { drugId: drug.id, region: 'KR' } },
        create: {
          drugId: drug.id,
          region: 'KR',
          authority: 'MFDS',
          approvalDate: permitDate,
          status,
          rawData: item.rawData as object,
        },
        update: {
          approvalDate: permitDate,
          status,
          rawData: item.rawData as object,
          updatedAt: new Date(),
        },
      })
    }

    return { inserted, updated }
  }
}
