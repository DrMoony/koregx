import { createAuthMiddleware } from '@drmoony/koregx-shared/auth'

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

// Next.js requires `config` to be a statically-analyzable literal — re-exporting
// authConfig from the shared package fails the Turbopack static analyzer.
// Keep in sync with `authConfig` in @drmoony/koregx-shared/auth.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
