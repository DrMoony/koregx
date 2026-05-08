import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchHiraDecisionSchema = z.object({
  query: z.string().min(1).describe('안건·약물·성분 키워드'),
  body: z.enum(['dbc', 'cancer']).optional().describe('약평위(dbc) | 암질심(cancer)'),
  dateFrom: z.string().optional().describe('YYYY-MM-DD'),
  dateTo: z.string().optional().describe('YYYY-MM-DD'),
  limit: z.number().int().min(1).max(100).default(30).optional(),
})

export const searchHiraDecisionTool = {
  name: 'search_hira_decision',
  description: 'HIRA (건강보험심사평가원) 약평위·암질심 결정 검색',
  inputSchema: searchHiraDecisionSchema,
  async execute(args: z.infer<typeof searchHiraDecisionSchema>) {
    const { query, body, dateFrom, dateTo, limit = 30 } = args
    const items = await prisma.hiraDecision.findMany({
      where: {
        AND: [
          {
            OR: [
              { agenda: { contains: query, mode: 'insensitive' } },
              { drug: { contains: query, mode: 'insensitive' } },
              { ingredient: { contains: query, mode: 'insensitive' } },
              { rationale: { contains: query, mode: 'insensitive' } },
            ],
          },
          body ? { body } : {},
          dateFrom ? { meetingDate: { gte: new Date(dateFrom) } } : {},
          dateTo ? { meetingDate: { lte: new Date(dateTo) } } : {},
        ],
      },
      take: limit,
      orderBy: { meetingDate: 'desc' },
    })
    return { items, total: items.length }
  },
}
