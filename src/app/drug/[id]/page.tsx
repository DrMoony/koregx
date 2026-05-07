import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DrugDetail } from '@/components/DrugDetail'

export default async function DrugPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const drug = await prisma.drug.findUnique({
    where: { id },
    include: { approvals: true, sourceDocs: true },
  })
  if (!drug) notFound()

  return (
    <main className="container mx-auto py-8 max-w-4xl">
      <DrugDetail drug={drug} />
    </main>
  )
}
