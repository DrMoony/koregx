import type { DrugWithFullDetail } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

export function DrugDetail({ drug }: { drug: DrugWithFullDetail }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{drug.productName}</h1>
        {drug.ingredient && (
          <p className="text-lg text-muted-foreground mt-2">성분: {drug.ingredient}</p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {drug.manufacturer && (
            <>
              <dt className="text-muted-foreground">제조/수입사</dt>
              <dd>{drug.manufacturer}</dd>
            </>
          )}
          {drug.category && (
            <>
              <dt className="text-muted-foreground">분류</dt>
              <dd>{drug.category}</dd>
            </>
          )}
          {drug.atc && (
            <>
              <dt className="text-muted-foreground">ATC</dt>
              <dd className="font-mono">{drug.atc}</dd>
            </>
          )}
          {drug.itemSeq && (
            <>
              <dt className="text-muted-foreground">식약처 품목코드</dt>
              <dd className="font-mono">{drug.itemSeq}</dd>
            </>
          )}
          <dt className="text-muted-foreground">상태</dt>
          <dd>{drug.status}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">허가 (Approvals)</h2>
        <div className="space-y-2">
          {drug.approvals.map((a) => (
            <div key={a.id} className="border rounded p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Badge>{a.region}</Badge>
                <span className="text-sm text-muted-foreground">{a.authority}</span>
              </div>
              {a.indication && <p className="text-sm">{a.indication}</p>}
              {a.approvalDate && (
                <p className="text-xs text-muted-foreground">
                  허가일: {new Date(a.approvalDate).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          ))}
          {drug.approvals.length === 0 && (
            <p className="text-sm text-muted-foreground">허가 데이터 없음</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">출처 문서</h2>
        <p className="text-sm text-muted-foreground">
          {drug.sourceDocs.length}건의 출처 문서
        </p>
      </section>
    </div>
  )
}
