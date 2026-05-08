/**
 * LLM Q&A Orchestrator
 *
 * natural language query
 *   → semantic retrieve (LegalInterpretation + AdminRule via pgvector)
 *   → Gemini 2.5 Flash answer with citations
 *   → verify_citations (regex extract + DB lookup)
 *   → QAResult
 *
 * Uses raw REST for Gemini (same pattern as PharmaNova llm-router).
 */
import { prisma } from '@/lib/db'
import { semanticSearchInterpretations, semanticSearchAdminRules } from './search'

const MODEL_PRIMARY = 'gemini-2.5-flash'
const MODEL_FALLBACK = 'gemini-2.0-flash'

const GEMINI_GENERATE = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

export interface CitationVerified {
  rawText: string
  verified: boolean
  foundEntity?: { type: string; id: string; nameKor?: string }
}

export interface QAResult {
  query: string
  answer: string
  retrievedInterpretations: Array<{ id: string; title: string; distance: number }>
  retrievedAdminRules: Array<{ id: string; name: string; distance: number }>
  citationsVerified: CitationVerified[]
  modelUsed: string
}

/**
 * Korean law citation pattern:
 *   [법명] 제[N]조(의 [N])?
 *   e.g. 약사법 제38조, 의료기기법 시행규칙 제10조의2
 */
const CITATION_REGEX = /([가-힣]+(?:법|령|규칙)(?:\s*시행(?:령|규칙))?)\s*제\s*(\d+)\s*조(?:의\s*(\d+))?/g

async function generateViaGemini(prompt: string, model: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  })
  const res = await fetch(GEMINI_GENERATE(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function verifyCitations(answer: string): Promise<CitationVerified[]> {
  const citations: CitationVerified[] = []
  const matches = answer.matchAll(CITATION_REGEX)
  const seen = new Set<string>()
  for (const m of matches) {
    const rawText = m[0]
    if (seen.has(rawText)) continue
    seen.add(rawText)
    const lawName = m[1]
    const articleNo = m[2]

    // Normalize law name: strip whitespace
    const lawNameNorm = lawName.replace(/\s+/g, ' ').trim()

    // Try to find law by shortName or partial nameKor match
    const law = await prisma.law.findFirst({
      where: {
        OR: [
          { shortName: { equals: lawNameNorm } },
          { nameKor: { contains: lawNameNorm.replace(/\s*시행(령|규칙)\s*/, '') } },
        ],
      },
      select: { id: true, nameKor: true, shortName: true },
    })

    if (!law) {
      citations.push({ rawText, verified: false })
      continue
    }

    // Try to find article
    const article = await prisma.lawArticle.findFirst({
      where: { lawId: law.id, articleNo },
      select: { id: true },
    })

    citations.push({
      rawText,
      verified: !!article,
      foundEntity: {
        type: article ? 'article' : 'law',
        id: article?.id ?? law.id,
        nameKor: article ? `${law.nameKor ?? law.shortName} 제${articleNo}조` : (law.nameKor ?? law.shortName ?? undefined),
      },
    })
  }
  return citations
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
  let modelUsed = MODEL_PRIMARY

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
    try {
      answer = await generateViaGemini(systemPrompt, MODEL_PRIMARY, apiKey)
      modelUsed = MODEL_PRIMARY
    } catch (e) {
      console.error('primary model failed, trying fallback:', e instanceof Error ? e.message : e)
      try {
        answer = await generateViaGemini(systemPrompt, MODEL_FALLBACK, apiKey)
        modelUsed = MODEL_FALLBACK
      } catch (e2) {
        const errMsg = e2 instanceof Error ? e2.message : String(e2)
        answer = `LLM 생성 실패: ${errMsg}\n\n검색 결과:\n${context.slice(0, 500)}`
        modelUsed = 'error'
      }
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
