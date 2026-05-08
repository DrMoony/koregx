export const dynamic = 'force-static'
export const runtime = 'nodejs'

const RESPONSE = {
  jsonrpc: '2.0',
  error: {
    code: -32000,
    message: 'KoRegX MCP server is offline for v0.2 re-architecture (drug catalog → law/interpretation primary). Live again shortly.',
    data: { repo: 'https://github.com/DrMoony/koregx' },
  },
}

function res() {
  return Response.json(RESPONSE, { status: 503 })
}

export async function GET() {
  return res()
}

export async function POST() {
  return res()
}

export async function DELETE() {
  return res()
}
