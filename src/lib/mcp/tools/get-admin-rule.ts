import { z } from 'zod'
import { prisma } from '@/lib/db'

export const getAdminRuleSchema = z.object({
  id: z.string().describe('AdminRule.id (cuid) 또는 arNo (행정규칙일련번호)'),
})

export const getAdminRuleTool = {
  name: 'get_admin_rule',
  description: '행정규칙 (고시·예규·훈령) 본문 lookup',
  inputSchema: getAdminRuleSchema,
  async execute(args: z.infer<typeof getAdminRuleSchema>) {
    const rule = await prisma.adminRule.findFirst({
      where: { OR: [{ id: args.id }, { arNo: args.id }] },
    })
    return { rule }
  },
}
