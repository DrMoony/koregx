import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function LawsPage() {
  // group by 법령ID (lawId) — show latest 시행 version per group
  // For simplicity, fetch all + group in JS
  const laws = await prisma.law.findMany({
    orderBy: [{ effectiveDate: 'desc' }],
  })

  // Group by lawId, take latest by effectiveDate per group
  const grouped = new Map<string, typeof laws[0]>()
  for (const l of laws) {
    const existing = grouped.get(l.lawId)
    if (!existing || (l.effectiveDate && existing.effectiveDate && l.effectiveDate > existing.effectiveDate)) {
      grouped.set(l.lawId, l)
    }
  }
  const uniqueLaws = Array.from(grouped.values()).sort((a, b) => a.nameKor.localeCompare(b.nameKor, 'ko-KR'))

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link href="/">← 홈</Link>
        </Button>
        <h1 className="text-3xl font-bold">한국 헬스케어 법령</h1>
        <p className="text-muted-foreground mt-1">{uniqueLaws.length}개 법령 (시행 중)</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {uniqueLaws.map((law) => (
          <Link key={law.id} href={`/laws/${law.id}`}>
            <Card className="hover:bg-accent/50 transition-colors h-full">
              <CardHeader>
                <CardTitle className="text-lg">{law.nameKor}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{law.category}</Badge>
                  <Badge variant="secondary">{law.agencyName}</Badge>
                </div>
                {law.effectiveDate && (
                  <p className="text-xs text-muted-foreground">
                    시행: {new Date(law.effectiveDate).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
