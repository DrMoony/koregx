import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchDrugSchema = z.object({
  query: z.string().min(1).describe('제품명, 성분명, 제조사 키워드'),
  limit: z.number().int().min(1).max(100).default(20).optional(),
})

export const searchDrugTool = {
  name: 'search_drug',
  description: '한국 식약처 의약품 검색 (제품명·성분·제조사). 다지역 검색은 v0.5+',
  inputSchema: searchDrugSchema,
  async execute(args: z.infer<typeof searchDrugSchema>) {
    const { query, limit = 20 } = args
    const drugs = await prisma.drug.findMany({
      where: {
        OR: [
          { productName: { contains: query, mode: 'insensitive' } },
          { ingredient: { contains: query, mode: 'insensitive' } },
          { manufacturer: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { approvals: true },
      take: limit,
      orderBy: { productName: 'asc' },
    })
    return { drugs, total: drugs.length }
  },
}
