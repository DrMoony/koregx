import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchAdminRuleSchema = z.object({
  query: z.string().min(1).describe('행정규칙명 키워드 (예: 의약품, 임상시험, 마약류)'),
  agency: z.string().optional().describe('소관부처 (예: 식품의약품안전처, 보건복지부)'),
  ruleType: z.string().optional().describe('규칙 종류 (고시 | 예규 | 훈령)'),
  limit: z.number().int().min(1).max(100).default(30).optional(),
})

export const searchAdminRuleTool = {
  name: 'search_admin_rule',
  description: '한국 헬스케어 행정규칙 검색 (식약처·복지부 고시·예규·훈령)',
  inputSchema: searchAdminRuleSchema,
  async execute(args: z.infer<typeof searchAdminRuleSchema>) {
    const { query, agency, ruleType, limit = 30 } = args
    const items = await prisma.adminRule.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { body: { contains: query, mode: 'insensitive' } },
            ],
          },
          agency ? { agencyName: { contains: agency } } : {},
          ruleType ? { ruleType } : {},
        ],
      },
      take: limit,
      orderBy: { promulgationDate: 'desc' },
    })
    return { items, total: items.length }
  },
}
