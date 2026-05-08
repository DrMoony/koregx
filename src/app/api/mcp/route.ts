import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createKoRegXServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handler(req: Request): Promise<Response> {
  const server = createKoRegXServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return await transport.handleRequest(req)
}

export { handler as GET, handler as POST, handler as DELETE }
