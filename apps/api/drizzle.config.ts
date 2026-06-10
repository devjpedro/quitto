import { defineConfig } from 'drizzle-kit'
import { parseEnv } from './src/env'

const env = parseEnv()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
})
