/**
 * Gemini gemini-embedding-001 helper (3072 native, truncated to 768 via outputDimensionality)
 *
 * Uses raw REST (same pattern as PharmaNova llm-router). Falls back to deterministic
 * hash-based embedding if API key is unavailable — vector search structurally works,
 * semantic quality degrades.
 *
 * Note: text-embedding-004 was deprecated. gemini-embedding-001 is the current model.
 * outputDimensionality=768 keeps schema compatibility (vector(768)).
 */

const EMBED_MODEL = 'gemini-embedding-001'
const DIM = 768
const EMBED_ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`

let _geminiKeyValid: boolean | null = null

export async function embed(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('cannot embed empty text')
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey && _geminiKeyValid !== false) {
    try {
      return await embedViaGeminiRest(text, apiKey)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('API_KEY_INVALID') || msg.includes('API Key not found') || msg.includes('400')) {
        console.warn('[embedding] Gemini API key invalid — falling back to hash embedding')
        _geminiKeyValid = false
      } else {
        throw e
      }
    }
  }
  // Deterministic fallback (hash-based) — ensures column gets populated
  return hashEmbed(text)
}

async function embedViaGeminiRest(text: string, apiKey: string): Promise<number[]> {
  // ~8000 chars ≈ 2000 tokens for Korean — stay under embedding model limit
  const truncated = text.slice(0, 8000)
  const body = JSON.stringify({
    content: { parts: [{ text: truncated }] },
    outputDimensionality: DIM,
  })
  const res = await fetch(EMBED_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini embedding HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } }
  const values = data.embedding?.values
  if (!values || values.length !== DIM) {
    throw new Error(`Gemini embedding invalid dim: ${values?.length ?? 0}`)
  }
  _geminiKeyValid = true
  return values
}

/**
 * Deterministic hash-based 768d embedding — provides text fingerprint,
 * not semantic similarity. Used when Gemini API key is unavailable.
 * Semantic vector search will work structurally but not semantically.
 */
function hashEmbed(text: string): number[] {
  const vec = new Float32Array(DIM)
  const bytes = textToBytes(text)
  // Fill with pseudo-random floats seeded by text bytes
  for (let i = 0; i < bytes.length; i++) {
    const slot = (bytes[i] * 31 + i) % DIM
    vec[slot] += Math.sin(bytes[i] * 0.1 + i * 0.01)
  }
  // Normalize to unit vector
  let norm = 0
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  return Array.from(vec).map((v) => v / norm)
}

function textToBytes(text: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    bytes.push(text.charCodeAt(i) & 0xff)
  }
  return bytes
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  const CONCURRENCY = 3
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY)
    const embeddings = await Promise.all(batch.map((t) => embed(t)))
    results.push(...embeddings)
  }
  return results
}

export function getEmbeddingMode(): 'gemini' | 'hash-fallback' {
  if (_geminiKeyValid === true) return 'gemini'
  if (_geminiKeyValid === false) return 'hash-fallback'
  // Not yet tested
  const apiKey = process.env.GEMINI_API_KEY
  return apiKey ? 'gemini' : 'hash-fallback'
}
