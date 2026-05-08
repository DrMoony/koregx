import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function Home() {
  const [lawCount, articleCount, interpCount, adminRuleCount, hiraCount] = await Promise.all([
    prisma.law.count(),
    prisma.lawArticle.count(),
    prisma.legalInterpretation.count(),
    prisma.adminRule.count(),
    prisma.hiraDecision.count(),
  ])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 p-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">KoRegX</h1>
        <p className="text-xl text-muted-foreground">
          Korean healthcare regulatory law &amp; interpretation reference
        </p>
        <p className="text-base text-muted-foreground">
          한국 헬스케어 법령 본문 + 법제처 행정해석 + 식약처·복지부 행정규칙 + HIRA 약평위·암질심 결정 통합 인터페이스
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-3xl w-full">
        <Stat label="법령" count={lawCount} href="/laws" />
        <Stat label="조문" count={articleCount} href="/laws" />
        <Stat label="행정해석" count={interpCount} href="/interpretations" />
        <Stat label="행정규칙" count={adminRuleCount} href="/admin-rules" />
        <Stat label="HIRA 결정" count={hiraCount} href="/decisions" />
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild>
          <Link href="/laws">법령 탐색</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/interpretations">행정해석 검색</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin-rules">행정규칙 검색</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/decisions">HIRA 결정</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="https://github.com/DrMoony/koregx" target="_blank">GitHub</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Open source · MIT · MCP server at <code className="font-mono">/api/mcp</code>
      </p>
    </main>
  )
}

function Stat({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link href={href} className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors text-center">
      <div className="text-2xl font-bold">{count.toLocaleString('ko-KR')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Link>
  )
}
