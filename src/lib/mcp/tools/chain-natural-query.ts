import { z } from 'zod'
import { answerNaturalQuery } from '@/lib/llm/qa'

export const chainNaturalQuerySchema = z.object({
  query: z
    .string()
    .min(3)
    .describe(
      '자연어 질문 (예: "약사법상 임상시험 sponsor의 의무가 뭐야?", "광고심의 받지 않은 의약품 광고는 어떻게 처분돼?")',
    ),
})

export const chainNaturalQueryTool = {
  name: 'chain_natural_query',
  description:
    'KoRegX 자연어 Q&A 오케스트레이터. 헬스케어 법령에 대한 자연어 질문을 받아 (1) 행정해석/행정규칙 의미검색 (pgvector cosine) (2) Gemini 2.5 Flash로 답변 합성 (3) 인용된 법조항 verify_citations로 검증. 답변 + 인용 검증 결과 반환.',
  inputSchema: chainNaturalQuerySchema,
  async execute(args: z.infer<typeof chainNaturalQuerySchema>) {
    return await answerNaturalQuery(args.query)
  },
}
