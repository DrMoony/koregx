import { prisma } from '../src/lib/db'

async function main() {
  const drug = await prisma.drug.findFirst({
    where: { productName: { contains: '위고비' } },
  })
  if (drug) {
    console.log(drug.id)
  } else {
    console.error('No drug found')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
}).finally(() => process.exit(0))
