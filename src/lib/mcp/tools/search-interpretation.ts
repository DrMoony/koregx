import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchInterpretationSchema = z.object({
  query: z.string().min(1).describe('안건명·회신문 키워드 (예: 임상시험, 약사법 38조, 의료기기 광고)'),
  lawShortName: z.string().optional().describe('법령 약칭 필터 (예: 약사법)'),
  dateFrom: z.string().optional().describe('YYYY-MM-DD'),
  dateTo: z.string().optional().describe('YYYY-MM-DD'),
  limit: z.number().int().min(1).max(100).default(30).optional(),
})

export const searchInterpretationTool = {
  name: 'search_interpretation',
  description:
    '법제처 행정해석 검색. 헬스케어 관계법령 (약사법·의료기기법·첨생법·국민건강보험법·마약류 등) 회신례.',
  inputSchema: searchInterpretationSchema,
  async execute(args: z.infer<typeof searchInterpretationSchema>) {
    const { query, lawShortName, dateFrom, dateTo, limit = 30 } = args
    const items = await prisma.legalInterpretation.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { body: { contains: query, mode: 'insensitive' } },
            ],
          },
          lawShortName
            ? {
                OR: [
                  { title: { contains: lawShortName, mode: 'insensitive' } },
                  { body: { contains: lawShortName, mode: 'insensitive' } },
                ],
              }
            : {},
          dateFrom ? { responseDate: { gte: new Date(dateFrom) } } : {},
          dateTo ? { responseDate: { lte: new Date(dateTo) } } : {},
        ],
      },
      take: limit,
      orderBy: { responseDate: 'desc' },
    })
    return { items, total: items.length }
  },
}
