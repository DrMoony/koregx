import Link from 'next/link'
import type { DrugWithApprovals } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DrugCard({ drug }: { drug: DrugWithApprovals }) {
  return (
    <Link href={`/drug/${drug.id}`}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardHeader>
          <CardTitle className="text-lg">{drug.productName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {drug.ingredient && (
            <p className="text-sm text-muted-foreground">성분: {drug.ingredient}</p>
          )}
          {drug.manufacturer && (
            <p className="text-sm text-muted-foreground">제조: {drug.manufacturer}</p>
          )}
          <div className="flex gap-1 flex-wrap">
            {drug.approvals.map((a) => (
              <Badge key={a.id} variant="outline">{a.region}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
