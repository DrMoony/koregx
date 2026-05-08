import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') , override: true })

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  console.log('GEMINI_API_KEY ends with:', apiKey?.slice(-8))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`
  const body = JSON.stringify({
    content: { parts: [{ text: '약사법 제38조 검증' }] },
    outputDimensionality: 768,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    console.error('HTTP', res.status, await res.text())
    process.exit(1)
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } }
  const v = data.embedding?.values
  console.log('OK dim:', v?.length, 'first 3:', v?.slice(0, 3))
}

main().catch((e) => { console.error(e); process.exit(1) })
