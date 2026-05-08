import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await prisma.hiraDecision.findUnique({ where: { id } })
  if (!d) notFound()

  return (
    <main className="container mx-auto py-8 max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/decisions">← HIRA 결정</Link></Button>
      <div>
        <Badge variant={d.body === 'dbc' ? 'default' : 'secondary'} className="mb-3">
          {d.body === 'dbc' ? '약평위 (약제급여평가위원회)' : '암질심 (암질환심의위원회)'}
        </Badge>
        <h1 className="text-2xl font-bold">{d.agenda}</h1>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline">{d.ruling}</Badge>
          <Badge variant="outline">{new Date(d.meetingDate).toLocaleDateString('ko-KR')}</Badge>
          {d.meetingNo && <Badge variant="outline">제{d.meetingNo}차</Badge>}
          {d.agendaNo && <Badge variant="outline">안건 {d.agendaNo}</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm mt-4">
          {d.drug && <><dt className="text-muted-foreground">약물</dt><dd>{d.drug}</dd></>}
          {d.ingredient && <><dt className="text-muted-foreground">성분</dt><dd>{d.ingredient}</dd></>}
        </dl>
      </div>

      {d.rationale && (
        <section className="border rounded-lg p-4 bg-muted/20">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">결정사유 (공개분)</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{d.rationale}</pre>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Source: <a href={d.sourceUrl} target="_blank" rel="noopener" className="underline font-mono">{d.sourceUrl}</a>
      </p>
    </main>
  )
}
