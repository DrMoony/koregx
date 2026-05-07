import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Prisma 7 needs explicit env loading — .env.local for Next.js projects
config({ path: path.join(process.cwd(), '.env.local') })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  experimental: {
    extensions: true,
  },
})
