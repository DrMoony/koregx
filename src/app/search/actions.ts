'use server'

import { prisma } from '@/lib/db'
import type { DrugSearchQuery, DrugSearchResult, DrugWithApprovals } from '@/lib/types'

export async function searchDrugs(q: DrugSearchQuery): Promise<DrugSearchResult> {
  const { q: query, limit = 20, offset = 0 } = q
  if (!query || query.trim().length === 0) {
    return { drugs: [], total: 0, limit, offset }
  }
  const where = {
    OR: [
      { productName: { contains: query, mode: 'insensitive' as const } },
      { ingredient: { contains: query, mode: 'insensitive' as const } },
      { manufacturer: { contains: query, mode: 'insensitive' as const } },
    ],
  }
  const [drugs, total] = await Promise.all([
    prisma.drug.findMany({
      where,
      include: { approvals: true },
      take: limit,
      skip: offset,
      orderBy: { productName: 'asc' },
    }) as Promise<DrugWithApprovals[]>,
    prisma.drug.count({ where }),
  ])
  return { drugs, total, limit, offset }
}
