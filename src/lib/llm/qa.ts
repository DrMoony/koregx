/**
 * LLM Q&A Orchestrator — KoRegX shim
 *
 * natural language query
 *   → semantic retrieve (LegalInterpretation + AdminRule via pgvector)
 *   → Gemini 2.5 Flash answer with citations
 *   → verify_citations (regex extract + DB lookup)
 *   → QAResult
 *
 * Thin wrapper around @drmoony/koregx-shared/llm.
 * prisma DB is injected into verifyCitations via CitationDb adapter.
 */
import { prisma } from '@/lib/db'
import {
  createQaClient,
  verifyCitations as sharedVerifyCitations,
  QA_MODEL_PRIMARY,
  QA_MODEL_FALLBACK,
  type CitationVerified,
  type CitationDb,
} from '@drmoony/koregx-shared/llm'
import { semanticSearchInterpretations, semanticSearchAdminRules } from './search'

export type { CitationVerified }

// Re-export for call-site compatibility
export { QA_MODEL_PRIMARY as MODEL_PRIMARY, QA_MODEL_FALLBACK as MODEL_FALLBACK }

export interface QAResult {
  query: string
  answer: string
  retrievedInterpretations: Array<{ id: string; title: string; distance: number }>
  retrievedAdminRules: Array<{ id: string; name: string; distance: number }>
  citationsVerified: CitationVerified[]
  modelUsed: string
}

/**
 * CitationDb adapter — bridges shared interface to KoRegX prisma client.
 */
const citationDb: CitationDb = {
  async findLaw(lawNameNorm: string) {
    return prisma.law.findFirst({
      where: {
        OR: [
          { shortName: { equals: lawNameNorm } },
          { nameKor: { contains: lawNameNorm.replace(/\s*시행(령|규칙)\s*/, '') } },
        ],
      },
      select: { id: true, nameKor: true, shortName: true },
    })
  },
  async findArticle(lawId: string, articleNo: string) {
    return prisma.lawArticle.findFirst({
      where: { lawId, articleNo },
      select: { id: true },
    })
  },
}

/**
 * verifyCitations — same signature as original (answer: string) for call-site compat.
 * Injects KoRegX prisma DB adapter internally.
 */
export async function verifyCitations(answer: string): Promise<CitationVerified[]> {
  return sharedVerifyCitations(answer, citationDb)
}

export async function answerNaturalQuery(query: string): Promise<QAResult> {
  const apiKey = process.env.GEMINI_API_KEY

  // Retrieve relevant interpretations + admin rules via semantic search
  const [interps, rules] = await Promise.all([
    semanticSearchInterpretations(query, 5).catch(() => []),
    semanticSearchAdminRules(query, 5).catch(() => []),
  ])

  // Build context for LLM
  const interpSection = interps.length
    ? [
        '## 관련 법제처 행정해석 (Top ' + interps.length + ')',
        ...interps.map((h, i) => {
          const e = h.entity as { title: string; body: string; caseNo: string | null }
          return `${i + 1}. [${e.caseNo ?? 'no-case-no'}] ${e.title}\n${e.body.slice(0, 600)}`
        }),
      ].join('\n\n')
    : '## 관련 행정해석: 없음 (검색 결과 없음)'

  const ruleSection = rules.length
    ? [
        '## 관련 행정규칙 (Top ' + rules.length + ')',
        ...rules.map((h, i) => {
          const e = h.entity as { name: string; body: string | undefined; ruleType: string; agencyName: string }
          return `${i + 1}. [${e.ruleType}/${e.agencyName}] ${e.name}\n${e.body?.slice(0, 400) ?? '(본문 없음)'}`
        }),
      ].join('\n\n')
    : '## 관련 행정규칙: 없음 (검색 결과 없음)'

  const context = [interpSection, ruleSection].join('\n\n---\n\n')

  const systemPrompt = `당신은 한국 헬스케어 법령 전문가다. 아래 검색된 행정해석/행정규칙을 근거로 사용자의 질문에 답한다.

원칙:
- 인용 시 "약사법 제38조" 형식으로 정확히 표기 (KoRegX가 자동 검증)
- 검색 결과에 없는 사실은 단정하지 말고 "검색 결과에 없음" 명시
- 짧고 명확하게. 항목별 bullet 권장.
- 의학/법률 용어 번역 금지 (원문 표기 유지)

검색 결과:
${context}

질문: ${query}`

  // LLM generation
  let answer = ''
  let modelUsed = QA_MODEL_PRIMARY

  if (!apiKey) {
    // No API key — provide context-based summary without LLM
    answer = [
      '⚠️ GEMINI_API_KEY 미설정 — LLM 합성 불가. 검색 결과만 반환합니다.',
      '',
      interps.length
        ? `관련 행정해석 ${interps.length}건:\n` +
          interps
            .slice(0, 3)
            .map((h) => `- ${(h.entity as { title: string }).title}`)
            .join('\n')
        : '관련 행정해석: 없음',
      '',
      rules.length
        ? `관련 행정규칙 ${rules.length}건:\n` +
          rules
            .slice(0, 3)
            .map((h) => `- ${(h.entity as { name: string }).name}`)
            .join('\n')
        : '관련 행정규칙: 없음',
    ].join('\n')
    modelUsed = 'none'
  } else {
    const qaClient = createQaClient({ apiKey })
    try {
      const result = await qaClient.generate(systemPrompt)
      answer = result.text
      modelUsed = result.modelUsed
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      answer = `LLM 생성 실패: ${errMsg}\n\n검색 결과:\n${context.slice(0, 500)}`
      modelUsed = 'error'
    }
  }

  // verify_citations: extract citation patterns from answer and verify against DB
  const citationsVerified = await verifyCitations(answer).catch(() => [])

  return {
    query,
    answer,
    retrievedInterpretations: interps.map((h) => ({
      id: h.id,
      title: (h.entity as { title: string }).title,
      distance: h.distance,
    })),
    retrievedAdminRules: rules.map((h) => ({
      id: h.id,
      name: (h.entity as { name: string }).name,
      distance: h.distance,
    })),
    citationsVerified,
    modelUsed,
  }
}
