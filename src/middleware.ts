import { createAuthMiddleware, authConfig } from '@drmoony/koregx-shared/auth'

export default createAuthMiddleware({
  publicPaths: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/mcp(.*)',  // MCP uses its own auth
    '/laws(.*)',
    '/interpretations(.*)',
    '/admin-rules(.*)',
    '/decisions(.*)',
  ],
})

export const config = authConfig
