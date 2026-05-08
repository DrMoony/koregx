import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: Promise<{ id: string; no: string }> }) {
  const { id, no } = await params
  const law = await prisma.law.findUnique({ where: { id } })
  if (!law) notFound()

  const article = await prisma.lawArticle.findFirst({
    where: { lawId: id, articleNo: no },
  })
  if (!article) notFound()

  // Chain: find LegalInterpretations whose body or title mentions this 법령 + 조문
  // Heuristic: title or body contains "{law.shortName or nameKor} 제{no}조"
  const lawShortName = law.shortName || law.nameKor
  const articleRef = `제${no}조`

  const interpretations = await prisma.legalInterpretation.findMany({
    where: {
      OR: [
        { title: { contains: lawShortName, mode: 'insensitive' } },
        { body: { contains: lawShortName, mode: 'insensitive' } },
      ],
      AND: [
        {
          OR: [
            { title: { contains: articleRef, mode: 'insensitive' } },
            { body: { contains: articleRef, mode: 'insensitive' } },
          ],
        },
      ],
    },
    take: 20,
    orderBy: { responseDate: 'desc' },
  })

  // Chain: find AdminRules whose name contains 법령 keyword
  const adminRules = await prisma.adminRule.findMany({
    where: {
      OR: [
        { name: { contains: lawShortName.replace('법', ''), mode: 'insensitive' } },
      ],
    },
    take: 20,
    orderBy: { promulgationDate: 'desc' },
  })

  return (
    <main className="container mx-auto py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/laws/${id}`}>← {law.nameKor}</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">
          {law.nameKor} 제{article.articleNo}조
          {article.articleSubNo ? `의${article.articleSubNo}` : ''}
          {article.title && <span className="ml-2 text-muted-foreground">({article.title})</span>}
        </h1>
        {article.effectiveDate && (
          <p className="text-sm text-muted-foreground mt-1">
            시행: {new Date(article.effectiveDate).toLocaleDateString('ko-KR')}
          </p>
        )}
      </div>

      <section className="border rounded-lg p-4 bg-muted/20">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">조문</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{article.body}</pre>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">
          관련 법제처 행정해석 <span className="text-sm text-muted-foreground font-normal">({interpretations.length}건)</span>
        </h2>
        {interpretations.length === 0 ? (
          <p className="text-sm text-muted-foreground">관련 행정해석 없음</p>
        ) : (
          <div className="space-y-2">
            {interpretations.map((i) => (
              <Link key={i.id} href={`/interpretations/${i.id}`} className="block border rounded p-3 hover:bg-accent/50">
                <p className="font-medium text-sm">{i.title}</p>
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  {i.caseNo && <span className="font-mono">{i.caseNo}</span>}
                  <span>{i.respondent}</span>
                  {i.responseDate && <span>{new Date(i.responseDate).toLocaleDateString('ko-KR')}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">
          관련 행정규칙 (고시·예규·훈령) <span className="text-sm text-muted-foreground font-normal">({adminRules.length}건)</span>
        </h2>
        {adminRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">관련 행정규칙 없음</p>
        ) : (
          <div className="space-y-2">
            {adminRules.map((r) => (
              <Link key={r.id} href={`/admin-rules/${r.id}`} className="block border rounded p-3 hover:bg-accent/50">
                <p className="font-medium text-sm">{r.name}</p>
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{r.ruleType}</Badge>
                  <span>{r.agencyName}</span>
                  {r.promulgationDate && <span>{new Date(r.promulgationDate).toLocaleDateString('ko-KR')}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
