import { SearchForm } from '@/components/SearchForm'
import { DrugCard } from '@/components/DrugCard'
import { searchDrugs } from './actions'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams
  const q = params.q ?? ''
  const result = q ? await searchDrugs({ q }) : null

  return (
    <main className="container mx-auto py-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-4">의약품 검색</h1>
        <SearchForm />
      </div>
      {result && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {result.total === 0 ? '검색 결과 없음' : `${result.total}건`}
          </p>
          <div className="grid gap-3">
            {result.drugs.map((drug) => (
              <DrugCard key={drug.id} drug={drug} />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
