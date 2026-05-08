import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SearchInput } from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ q?: string; body?: string }> }) {
  const params = await searchParams
  const q = params.q ?? ''
  const bodyFilter = params.body

  const where = {
    AND: [
      bodyFilter ? { body: bodyFilter } : {},
      q ? {
        OR: [
          { agenda: { contains: q, mode: 'insensitive' as const } },
          { drug: { contains: q, mode: 'insensitive' as const } },
          { ingredient: { contains: q, mode: 'insensitive' as const } },
          { rationale: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {},
    ],
  }

  const items = await prisma.hiraDecision.findMany({
    where,
    take: 50,
    orderBy: { meetingDate: 'desc' },
  })

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/">← 홈</Link></Button>
      <div>
        <h1 className="text-3xl font-bold">HIRA 결정</h1>
        <p className="text-muted-foreground mt-1">약평위 (DBC) + 암질심 (Cancer) 결정</p>
      </div>

      <div className="flex gap-2">
        <Button asChild variant={!bodyFilter ? 'default' : 'outline'} size="sm">
          <Link href={q ? `/decisions?q=${encodeURIComponent(q)}` : '/decisions'}>전체</Link>
        </Button>
        <Button asChild variant={bodyFilter === 'dbc' ? 'default' : 'outline'} size="sm">
          <Link href={q ? `/decisions?q=${encodeURIComponent(q)}&body=dbc` : '/decisions?body=dbc'}>약평위</Link>
        </Button>
        <Button asChild variant={bodyFilter === 'cancer' ? 'default' : 'outline'} size="sm">
          <Link href={q ? `/decisions?q=${encodeURIComponent(q)}&body=cancer` : '/decisions?body=cancer'}>암질심</Link>
        </Button>
      </div>

      <SearchInput initial={q} action="/decisions" placeholder="안건·약물·성분 검색" extraParams={bodyFilter ? { body: bodyFilter } : undefined} />

      <p className="text-sm text-muted-foreground">{items.length}건</p>

      <div className="space-y-3">
        {items.map((d) => (
          <Link key={d.id} href={`/decisions/${d.id}`} className="block border rounded-lg p-4 hover:bg-accent/50">
            <div className="flex items-start gap-3">
              <Badge variant={d.body === 'dbc' ? 'default' : 'secondary'}>
                {d.body === 'dbc' ? '약평위' : '암질심'}
              </Badge>
              <div className="flex-1">
                <h3 className="font-medium text-sm">{d.agenda}</h3>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {d.drug && <span>{d.drug}</span>}
                  {d.ingredient && <span>({d.ingredient})</span>}
                  <Badge variant="outline" className="text-xs">{d.ruling}</Badge>
                  <span>{new Date(d.meetingDate).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
