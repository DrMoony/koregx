export const dynamic = "force-static"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">KoRegX</h1>
        <p className="text-xl text-muted-foreground">
          Korean healthcare regulatory law &amp; interpretation reference
        </p>
        <p className="text-base text-muted-foreground">
          v0.2 재구축 중 — 법령 + 행정해석 + 행정규칙 anchor로 완전 재설계 중입니다.
        </p>
        <p className="text-sm text-muted-foreground">
          Re-architecting from drug catalog (deprecated) to law/interpretation primary.
          Live shortly.
        </p>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        github.com/DrMoony/koregx
      </p>
    </main>
  )
}
