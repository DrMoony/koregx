import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">KoRegX</h1>
        <p className="text-xl text-muted-foreground">
          Korea-anchored cross-region pharma regulatory intelligence
        </p>
        <p className="text-muted-foreground">
          한국·FDA·EMA·PMDA·NMPA의 의약품 허가·급여·규제 정보를 단일 인터페이스에서.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/search">의약품 검색</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="https://github.com/drmoony/koregx" target="_blank">GitHub</Link>
        </Button>
      </div>
    </main>
  )
}
