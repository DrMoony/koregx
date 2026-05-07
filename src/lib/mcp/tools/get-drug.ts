import { z } from 'zod'
import { prisma } from '@/lib/db'

export const getDrugSchema = z.object({
  id: z.string().describe('Drug.id (cuid) 또는 itemSeq (식약처 품목코드)'),
})

export const getDrugTool = {
  name: 'get_drug',
  description: '특정 약물 상세 (허가 + 출처 문서 포함). id (cuid) 또는 itemSeq 양쪽 지원',
  inputSchema: getDrugSchema,
  async execute(args: z.infer<typeof getDrugSchema>) {
    const { id } = args
    const drug = await prisma.drug.findFirst({
      where: { OR: [{ id }, { itemSeq: id }] },
      include: { approvals: true, sourceDocs: true },
    })
    return { drug }
  },
}
