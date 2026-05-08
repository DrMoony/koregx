import { z } from 'zod'
import { prisma } from '@/lib/db'

export const chainLawLifecycleSchema = z.object({
  lawShortName: z.string().describe('법령명 (예: 약사법)'),
  articleNo: z.string().describe('조문번호 (예: "38")'),
})

export const chainLawLifecycleTool = {
  name: 'chain_law_lifecycle',
  description:
    '특정 조문의 통합 dossier: 본문 + 적용 법제처 행정해석 + 관련 행정규칙. KoRegX의 핵심 USP — reg professional의 "이 조문이 어떻게 해석됐고 어떤 고시로 구체화됐나" 질문에 한 번에 답변',
  inputSchema: chainLawLifecycleSchema,
  async execute(args: z.infer<typeof chainLawLifecycleSchema>) {
    const { lawShortName, articleNo } = args

    const law = await prisma.law.findFirst({
      where: {
        OR: [
          { shortName: { equals: lawShortName, mode: 'insensitive' } },
          { nameKor: { contains: lawShortName, mode: 'insensitive' } },
        ],
        category: '법률',
      },
      orderBy: { effectiveDate: 'desc' },
    })
    if (!law)
      return {
        matched: false,
        summary: `법령 없음: ${lawShortName}`,
        law: null,
        article: null,
        interpretations: [],
        adminRules: [],
      }

    const article = await prisma.lawArticle.findFirst({
      where: { lawId: law.id, articleNo },
    })

    const articleRef = `제${articleNo}조`
    const interpretations = await prisma.legalInterpretation.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: lawShortName, mode: 'insensitive' } },
              { body: { contains: lawShortName, mode: 'insensitive' } },
            ],
          },
          {
            OR: [
              { title: { contains: articleRef, mode: 'insensitive' } },
              { body: { contains: articleRef, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 30,
      orderBy: { responseDate: 'desc' },
    })

    const lawKeyword = (law.shortName || law.nameKor).replace(/법$/, '')
    const adminRules = await prisma.adminRule.findMany({
      where: { name: { contains: lawKeyword, mode: 'insensitive' } },
      take: 30,
      orderBy: { promulgationDate: 'desc' },
    })

    const summary = [
      `${law.nameKor} 제${articleNo}조`,
      article?.title ? `(${article.title})` : '',
      '—',
      `행정해석 ${interpretations.length}건`,
      `+ 관련 행정규칙 ${adminRules.length}건`,
    ]
      .filter(Boolean)
      .join(' ')

    return {
      matched: !!article,
      summary,
      law,
      article,
      interpretations,
      adminRules,
    }
  },
}
