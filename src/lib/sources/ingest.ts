import { MfdsSource, type MfdsFetchArgs } from './mfds'
import type { IngestResult } from '@/lib/types'

export async function ingestMfds(query: string, limit = 50): Promise<IngestResult> {
  const serviceKey = process.env.MFDS_SERVICE_KEY
  if (!serviceKey) throw new Error('MFDS_SERVICE_KEY env not set')

  const source = new MfdsSource({ serviceKey })
  return source.run({ query, limit } as MfdsFetchArgs)
}
