import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function LawDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const law = await prisma.law.findUnique({
    where: { id },
    include: {
      articles: { orderBy: [{ articleNo: 'asc' }] },
    },
  })
  if (!law) notFound()

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/laws">← 법령 list</Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">{law.nameKor}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge>{law.category}</Badge>
          <Badge variant="outline">{law.agencyName}</Badge>
          {law.amendmentType && <Badge variant="secondary">{law.amendmentType}</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm mt-4">
          {law.effectiveDate && (
            <>
              <dt className="text-muted-foreground">시행일</dt>
              <dd>{new Date(law.effectiveDate).toLocaleDateString('ko-KR')}</dd>
            </>
          )}
          {law.promulgationDate && (
            <>
              <dt className="text-muted-foreground">공포일</dt>
              <dd>{new Date(law.promulgationDate).toLocaleDateString('ko-KR')}</dd>
            </>
          )}
          {law.promulgationNo && (
            <>
              <dt className="text-muted-foreground">공포번호</dt>
              <dd className="font-mono">{law.promulgationNo}</dd>
            </>
          )}
          <dt className="text-muted-foreground">법령일련번호 (MST)</dt>
          <dd className="font-mono">{law.mst}</dd>
        </dl>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">조문 ({law.articles.length}개)</h2>
        <div className="space-y-1 max-h-[600px] overflow-y-auto border rounded p-4">
          {law.articles.map((a) => (
            <Link
              key={a.id}
              href={`/laws/${law.id}/articles/${a.articleNo}`}
              className="block py-1 px-2 rounded hover:bg-accent text-sm"
            >
              <span className="font-mono text-muted-foreground">제{a.articleNo}조{a.articleSubNo ? `의${a.articleSubNo}` : ''}</span>
              {a.title && <span className="ml-2">{a.title}</span>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
