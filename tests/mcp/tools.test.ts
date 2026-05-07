import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { searchDrugTool } from '@/lib/mcp/tools/search-drug'
import { getDrugTool } from '@/lib/mcp/tools/get-drug'
import { chainDrugDossierTool } from '@/lib/mcp/tools/chain-drug-dossier'
import { prisma } from '@/lib/db'

beforeAll(async () => {
  // Ensure test fixture exists (MCP_TEST_ prefix to avoid collision with mfds.test.ts's TEST_ cleanup)
  await prisma.drug.upsert({
    where: { itemSeq: 'MCP_TEST_001' },
    create: {
      itemSeq: 'MCP_TEST_001',
      productName: '위고비테스트프리필드펜',
      ingredient: 'Semaglutide',
      manufacturer: '테스트제약(주)',
      atc: 'A10BJ06',
      category: '전문의약품',
      approvals: { create: { region: 'KR', authority: 'MFDS' } },
    },
    update: {},
  })
})

afterAll(async () => {
  const items = await prisma.drug.findMany({
    where: { itemSeq: { startsWith: 'MCP_TEST_' } },
    select: { id: true },
  })
  if (items.length > 0) {
    const ids = items.map((d) => d.id)
    await prisma.approval.deleteMany({ where: { drugId: { in: ids } } })
    await prisma.drug.deleteMany({ where: { id: { in: ids } } })
  }
})

describe('search_drug tool', () => {
  it('returns matching drugs by product name', async () => {
    const result = await searchDrugTool.execute({ query: '위고비테스트' })
    expect(result.drugs.length).toBeGreaterThan(0)
    const found = result.drugs.find((d) => d.productName.includes('위고비테스트'))
    expect(found).toBeTruthy()
  })

  it('returns matching drugs by ingredient', async () => {
    const result = await searchDrugTool.execute({ query: 'Semaglutide' })
    expect(result.drugs.length).toBeGreaterThan(0)
  })

  it('returns empty array for no match', async () => {
    const result = await searchDrugTool.execute({ query: '존재하지않는약물xyzunique' })
    expect(result.drugs).toEqual([])
  })

  it('respects limit', async () => {
    const result = await searchDrugTool.execute({ query: '위고비', limit: 1 })
    expect(result.drugs.length).toBeLessThanOrEqual(1)
  })
})

describe('get_drug tool', () => {
  it('returns drug with approvals by id (cuid)', async () => {
    const drug = await prisma.drug.findUnique({ where: { itemSeq: 'MCP_TEST_001' } })
    if (!drug) throw new Error('test fixture missing')
    const result = await getDrugTool.execute({ id: drug.id })
    expect(result.drug?.productName).toBe('위고비테스트프리필드펜')
    expect(result.drug?.approvals).toHaveLength(1)
    expect(result.drug?.approvals[0].region).toBe('KR')
  })

  it('returns drug by itemSeq fallback', async () => {
    const result = await getDrugTool.execute({ id: 'MCP_TEST_001' })
    expect(result.drug?.itemSeq).toBe('MCP_TEST_001')
  })

  it('returns null for non-existent id', async () => {
    const result = await getDrugTool.execute({ id: 'nonexistent_xyz_123' })
    expect(result.drug).toBeNull()
  })
})

describe('chain_drug_dossier tool', () => {
  it('combines search + detail in one call (matched=true)', async () => {
    const result = await chainDrugDossierTool.execute({ query: '위고비테스트' })
    expect(result.matched).toBe(true)
    expect(result.summary).toContain('위고비테스트')
    expect(result.drug?.approvals).toHaveLength(1)
  })

  it('returns matched=false when no result', async () => {
    const result = await chainDrugDossierTool.execute({ query: '존재하지않음xyz999' })
    expect(result.matched).toBe(false)
    expect(result.drug).toBeNull()
  })

  it('summary includes ingredient and region', async () => {
    const result = await chainDrugDossierTool.execute({ query: '위고비테스트' })
    expect(result.matched).toBe(true)
    expect(result.summary).toContain('Semaglutide')
    expect(result.summary).toContain('KR')
  })
})
