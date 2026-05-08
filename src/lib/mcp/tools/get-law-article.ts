import { z } from 'zod'
import { prisma } from '@/lib/db'

export const getLawArticleSchema = z.object({
  lawShortName: z.string().describe('법령명 (전체 또는 약칭, 예: 약사법)'),
  articleNo: z.string().describe('조문번호 (예: "38")'),
  articleSubNo: z.string().optional().describe('조문가지번호 (예: "2" for 제38조의2)'),
})

export const getLawArticleTool = {
  name: 'get_law_article',
  description: '특정 법령 조문 본문 lookup',
  inputSchema: getLawArticleSchema,
  async execute(args: z.infer<typeof getLawArticleSchema>) {
    const { lawShortName, articleNo, articleSubNo } = args

    // Find law by name (try shortName first, then nameKor)
    const law = await prisma.law.findFirst({
      where: {
        OR: [
          { shortName: { equals: lawShortName, mode: 'insensitive' } },
          { nameKor: { contains: lawShortName, mode: 'insensitive' } },
        ],
        category: '법률', // prefer 본법
      },
      orderBy: { effectiveDate: 'desc' },
    })

    if (!law) return { article: null, law: null, error: `법령 못 찾음: ${lawShortName}` }

    const article = await prisma.lawArticle.findFirst({
      where: { lawId: law.id, articleNo, articleSubNo: articleSubNo ?? null },
    })

    return { law, article }
  },
}
