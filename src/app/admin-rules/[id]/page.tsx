import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminRuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rule = await prisma.adminRule.findUnique({ where: { id } })
  if (!rule) notFound()

  return (
    <main className="container mx-auto py-8 max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/admin-rules">← 행정규칙</Link></Button>
      <div>
        <h1 className="text-2xl font-bold">{rule.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge>{rule.ruleType}</Badge>
          <Badge variant="outline">{rule.agencyName}</Badge>
          {rule.promulgationDate && <Badge variant="secondary">{new Date(rule.promulgationDate).toLocaleDateString('ko-KR')}</Badge>}
        </div>
      </div>
      {rule.body ? (
        <section className="border rounded-lg p-4 bg-muted/20">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">본문</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{rule.body}</pre>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">본문은 별도 ingest 단계 (P9 시점) 또는 원문 link 참조</p>
      )}
    </main>
  )
}
