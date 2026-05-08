import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SearchInput } from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminRulesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams
  const q = params.q ?? ''

  const items = q
    ? await prisma.adminRule.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] },
        take: 50,
        orderBy: { promulgationDate: 'desc' },
      })
    : await prisma.adminRule.findMany({ take: 30, orderBy: { promulgationDate: 'desc' } })

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/">← 홈</Link></Button>
      <div>
        <h1 className="text-3xl font-bold">행정규칙 (고시·예규·훈령)</h1>
        <p className="text-muted-foreground mt-1">헬스케어 분야 식약처·복지부 행정규칙</p>
      </div>
      <SearchInput initial={q} action="/admin-rules" placeholder="규칙명 검색 (예: 의약품, 임상시험)" />
      <p className="text-sm text-muted-foreground">{q ? `"${q}" 검색 결과 ${items.length}건` : `최근 ${items.length}건`}</p>
      <div className="space-y-3">
        {items.map((r) => (
          <Link key={r.id} href={`/admin-rules/${r.id}`} className="block border rounded-lg p-4 hover:bg-accent/50">
            <h3 className="font-medium">{r.name}</h3>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">{r.ruleType}</Badge>
              <span>{r.agencyName}</span>
              {r.promulgationDate && <span>{new Date(r.promulgationDate).toLocaleDateString('ko-KR')}</span>}
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
