import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchLawSchema = z.object({
  query: z.string().min(1).describe('법령명 또는 약칭 (예: 약사법, 의료기기법, 첨생법)'),
  category: z.string().optional().describe('법령구분 (법률 | 대통령령 | 총리령 | 부령)'),
  agencyName: z.string().optional().describe('소관부처명 일부'),
  limit: z.number().int().min(1).max(100).default(20).optional(),
})

export const searchLawTool = {
  name: 'search_law',
  description:
    '한국 헬스케어 법령 검색 (법령명·약칭). 약사법·의료기기법·첨단재생의료법·국민건강보험법·마약류관리법·희귀질환관리법·혁신의료기기법 + 시행령/시행규칙',
  inputSchema: searchLawSchema,
  async execute(args: z.infer<typeof searchLawSchema>) {
    const { query, category, agencyName, limit = 20 } = args
    const laws = await prisma.law.findMany({
      where: {
        AND: [
          {
            OR: [
              { nameKor: { contains: query, mode: 'insensitive' } },
              { shortName: { contains: query, mode: 'insensitive' } },
            ],
          },
          category ? { category } : {},
          agencyName ? { agencyName: { contains: agencyName } } : {},
        ],
      },
      take: limit,
      orderBy: [{ effectiveDate: 'desc' }, { nameKor: 'asc' }],
    })
    return { laws, total: laws.length }
  },
}
