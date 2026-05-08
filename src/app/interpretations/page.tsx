import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SearchInput } from '@/components/SearchInput'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function InterpretationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams
  const q = params.q ?? ''

  const items = q
    ? await prisma.legalInterpretation.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 50,
        orderBy: { responseDate: 'desc' },
      })
    : await prisma.legalInterpretation.findMany({
        take: 30,
        orderBy: { responseDate: 'desc' },
      })

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/">← 홈</Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">법제처 행정해석</h1>
        <p className="text-muted-foreground mt-1">헬스케어 관계법령 행정해석 회신</p>
      </div>

      <SearchInput initial={q} action="/interpretations" placeholder="안건명·회신문 검색 (예: 약사법, 임상시험)" />

      <p className="text-sm text-muted-foreground">{q ? `"${q}" 검색 결과 ${items.length}건` : `최근 ${items.length}건`}</p>

      <div className="space-y-3">
        {items.map((i) => (
          <Link key={i.id} href={`/interpretations/${i.id}`} className="block border rounded-lg p-4 hover:bg-accent/50">
            <h3 className="font-medium">{i.title}</h3>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              {i.caseNo && <span className="font-mono">{i.caseNo}</span>}
              <span>{i.respondent}</span>
              {i.responseDate && <span>{new Date(i.responseDate).toLocaleDateString('ko-KR')}</span>}
            </div>
            {i.body && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                {i.body.slice(0, 300)}…
              </p>
            )}
          </Link>
        ))}
      </div>
    </main>
  )
}
