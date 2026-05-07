import { describe, it, expect } from 'vitest'
import { SourcePlugin } from '@/lib/sources/base'

describe('SourcePlugin abstract base', () => {
  it('exposes name + region from subclass', () => {
    class TestSource extends SourcePlugin {
      name = 'test'
      region = 'KR' as const
      async fetch() { return [] }
      async parse(_raw: unknown) { return [] }
    }
    const s = new TestSource()
    expect(s.name).toBe('test')
    expect(s.region).toBe('KR')
  })

  it('runs fetch -> parse -> persist orchestration', async () => {
    const persisted: unknown[] = []
    class TestSource extends SourcePlugin {
      name = 'test'
      region = 'KR' as const
      async fetch() { return [{ id: 1 }, { id: 2 }] }
      async parse(raw: unknown) { return [{ parsed: (raw as { id: number }).id }] }
      async persist(items: unknown[]) { persisted.push(...items); return { inserted: items.length, updated: 0 } }
    }
    const s = new TestSource()
    const result = await s.run()
    expect(persisted).toEqual([{ parsed: 1 }, { parsed: 2 }])
    expect(result.fetched).toBe(2)
    expect(result.inserted).toBe(2)
    expect(result.errors).toEqual([])
  })

  it('captures errors per item without aborting', async () => {
    class TestSource extends SourcePlugin {
      name = 'test'
      region = 'KR' as const
      async fetch() { return [{ id: 1 }, { id: 2 }, { id: 3 }] }
      async parse(raw: unknown) {
        if ((raw as { id: number }).id === 2) throw new Error('parse fail #2')
        return [{ ok: (raw as { id: number }).id }]
      }
      async persist(items: unknown[]) { return { inserted: items.length, updated: 0 } }
    }
    const s = new TestSource()
    const result = await s.run()
    expect(result.fetched).toBe(3)
    expect(result.inserted).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error).toContain('parse fail #2')
  })
})
