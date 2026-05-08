import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function InterpretationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const interp = await prisma.legalInterpretation.findUnique({
    where: { id },
    include: { law: true },
  })
  if (!interp) notFound()

  return (
    <main className="container mx-auto py-8 max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/interpretations">← 행정해석</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{interp.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {interp.caseNo && <Badge variant="outline" className="font-mono">{interp.caseNo}</Badge>}
          <Badge>{interp.respondent}</Badge>
          {interp.responseDate && <Badge variant="secondary">{new Date(interp.responseDate).toLocaleDateString('ko-KR')}</Badge>}
        </div>
        {interp.inquirer && (
          <p className="text-sm text-muted-foreground mt-2">회신요청자: {interp.inquirer}</p>
        )}
      </div>

      <section className="border rounded-lg p-4 bg-muted/20">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">회신 본문</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{interp.body}</pre>
      </section>

      {interp.law && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">관련 법령</h2>
          <Link href={`/laws/${interp.law.id}`} className="inline-block">
            <Badge variant="outline">{interp.law.nameKor}</Badge>
          </Link>
        </section>
      )}
    </main>
  )
}
