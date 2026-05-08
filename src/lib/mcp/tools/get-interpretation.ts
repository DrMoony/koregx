import { z } from 'zod'
import { prisma } from '@/lib/db'

export const getInterpretationSchema = z.object({
  id: z.string().describe('LegalInterpretation.id (cuid) 또는 ipNo (법령해석례일련번호)'),
})

export const getInterpretationTool = {
  name: 'get_interpretation',
  description: '법제처 행정해석 회신 본문 lookup',
  inputSchema: getInterpretationSchema,
  async execute(args: z.infer<typeof getInterpretationSchema>) {
    const interp = await prisma.legalInterpretation.findFirst({
      where: { OR: [{ id: args.id }, { ipNo: args.id }] },
      include: { law: true },
    })
    return { interpretation: interp }
  },
}
