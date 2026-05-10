/**
 * Shim: delegates to @drmoony/koregx-shared/llm embedding factory.
 * Singleton client created with GEMINI_API_KEY from env — same behavior as original.
 */
import { createEmbeddingClient } from '@drmoony/koregx-shared/llm'

const _client = createEmbeddingClient({
  apiKey: process.env.GEMINI_API_KEY ?? '',
})

export async function embed(text: string): Promise<number[]> {
  return _client.embed(text)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return _client.embedBatch(texts)
}

export function getEmbeddingMode(): 'gemini' | 'hash-fallback' {
  return _client.getEmbeddingMode()
}
