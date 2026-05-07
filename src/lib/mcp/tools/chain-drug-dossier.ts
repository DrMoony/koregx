import { z } from 'zod'
import { prisma } from '@/lib/db'

export const chainDrugDossierSchema = z.object({
  query: z.string().min(1).describe('약물 검색어'),
})

export const chainDrugDossierTool = {
  name: 'chain_drug_dossier',
  description: '약물 검색 → 첫 매칭 약물의 허가·출처 통합 dossier 반환',
  inputSchema: chainDrugDossierSchema,
  async execute(args: z.infer<typeof chainDrugDossierSchema>) {
    const { query } = args
    const drug = await prisma.drug.findFirst({
      where: {
        OR: [
          { productName: { contains: query, mode: 'insensitive' } },
          { ingredient: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { approvals: true, sourceDocs: true },
      orderBy: { productName: 'asc' },
    })
    if (!drug) {
      return { matched: false, summary: `"${query}"에 매칭되는 약물 없음`, drug: null }
    }
    const approvalRegions = drug.approvals.map((a) => a.region).join(', ') || '(없음)'
    const summary = `${drug.productName} — ${drug.ingredient ?? '성분 미상'}. 제조: ${drug.manufacturer ?? '미상'}. 허가 region: ${approvalRegions}.`
    return { matched: true, summary, drug }
  },
}
