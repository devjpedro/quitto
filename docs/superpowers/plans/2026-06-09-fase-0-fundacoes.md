# Fase 0 — Fundações + Spike do Eden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar o esqueleto do monorepo Quitto (Bun + Turborepo) com `api` (Elysia), `web` (React+Vite) e `shared`, provando que o **Eden Treaty tipa cross-package mesmo com o Better Auth montado** (mitigação da issue eden#215), com tooling, banco (Drizzle+Postgres), CI e configs de deploy.

**Architecture:** Monorepo Bun workspaces orquestrado por Turborepo. A API Elysia exporta `type App`; o front consome via `treaty<App>()` importando o tipo cruzando o pacote `@quitto/api`. O Better Auth é montado como **handler puro** (sem usar a `.macro()` que quebra o Eden), e o front conversa com a API por **proxy de mesma origem** (`vercel.json`). Banco via Drizzle ORM contra Postgres.

**Tech Stack:** Bun, Turborepo, TypeScript (strict), Elysia, `@elysiajs/eden`, Better Auth, Drizzle ORM + `postgres`, Zod, React 19 + Vite, Tailwind v4, Biome + Ultracite, Lefthook, Vitest, `bun test`, Docker (Fly), GitHub Actions.

> **Pré-requisitos do ambiente:** `bun` instalado (`bun --version` ≥ 1.2). Um Postgres local para testes de integração: `docker run --name quitto-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=quitto -p 5432:5432 -d postgres:16`. O repo `quitto/` já existe e tem git inicializado.

---

## Estrutura de arquivos (mapa)

```
quitto/
├─ package.json              # root: workspaces + scripts turbo
├─ turbo.json                # tasks: build/dev/lint/typecheck/test
├─ tsconfig.base.json        # compiler options compartilhadas (strict)
├─ biome.jsonc               # extends ultracite
├─ lefthook.yml              # pre-commit: biome + typecheck
├─ .env.example
├─ .github/workflows/ci.yml
├─ packages/
│  └─ shared/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/index.ts        # tipos/utils compartilhados (seed: Brand, makeEnv)
└─ apps/
   ├─ api/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  ├─ drizzle.config.ts
   │  ├─ Dockerfile
   │  ├─ fly.toml
   │  ├─ src/
   │  │  ├─ env.ts           # Zod.parse(process.env)
   │  │  ├─ db/client.ts     # drizzle + postgres
   │  │  ├─ db/schema.ts     # tabelas do Better Auth (1ª migração)
   │  │  ├─ auth.ts          # instância Better Auth (handler puro)
   │  │  ├─ app.ts           # buildApp() -> Elysia; export type App
   │  │  └─ index.ts         # listen()
   │  └─ tests/
   │     ├─ env.test.ts
   │     ├─ ping.test.ts     # Eden in-process
   │     └─ db-health.test.ts
   └─ web/
      ├─ package.json
      ├─ tsconfig.json
      ├─ vite.config.ts
      ├─ vercel.json         # proxy /api/* -> Fly
      ├─ index.html
      ├─ src/
      │  ├─ main.tsx
      │  ├─ App.tsx
      │  ├─ index.css        # tailwind v4
      │  └─ lib/api.ts       # treaty<App>() importando @quitto/api
      └─ tests/eden-types.test.ts  # prova: data NÃO é any
```

---

## Task 1: Inicializar a raiz do monorepo (Bun workspaces + Turborepo)

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`

- [ ] **Step 1: Criar `package.json` na raiz**

```json
{
  "name": "quitto",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "bun@1.2.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Criar `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 3: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Criar `.env.example`**

```bash
# API
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quitto
BETTER_AUTH_SECRET=dev-secret-change-me-min-32-chars-long
BETTER_AUTH_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:3001

# WEB (Vite)
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 5: Instalar e verificar**

Run: `bun install`
Expected: instala sem erro; cria `bun.lock`.

- [ ] **Step 6: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .env.example bun.lock
git commit -m "chore: scaffold do monorepo (bun workspaces + turborepo)"
```

---

## Task 2: Pacote `shared` (tipos/utils compartilhados + helper de env)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Criar `packages/shared/package.json`**

```json
{
  "name": "@quitto/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "lint": "biome check .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "latest" },
  "devDependencies": { "typescript": "latest", "@biomejs/biome": "latest" }
}
```

- [ ] **Step 2: Criar `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `packages/shared/src/index.ts`**

```ts
import { z } from 'zod'

/** Cria e valida um objeto de env a partir de um schema Zod, falhando cedo. */
export function makeEnv<T extends z.ZodTypeAny>(schema: T, source: unknown): z.infer<T> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`)
  }
  return result.data
}

/** Formato do envelope de erro da API (decisão do spec: code + message + details). */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> }
}
```

- [ ] **Step 4: Instalar e typecheck**

Run: `bun install && bun --filter @quitto/shared typecheck`
Expected: PASS (sem erros de tipo).

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): helper de env e tipo do envelope de erro"
```

---

## Task 3: Pacote `api` — esqueleto Elysia + validação de env (TDD)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/env.ts`
- Test: `apps/api/tests/env.test.ts`

- [ ] **Step 1: Criar `apps/api/package.json`**

```json
{
  "name": "@quitto/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/app.ts" },
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --target bun --outdir dist",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@quitto/shared": "workspace:*",
    "elysia": "latest",
    "@elysiajs/cors": "latest",
    "better-auth": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@elysiajs/eden": "latest",
    "drizzle-kit": "latest",
    "typescript": "latest",
    "@biomejs/biome": "latest",
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Criar `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src", "tests", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Instalar deps**

Run: `bun install`
Expected: instala elysia, better-auth, drizzle etc. sem erro.

- [ ] **Step 4: Escrever o teste de env que falha**

Create `apps/api/tests/env.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { parseEnv } from '../src/env'

describe('parseEnv', () => {
  it('rejeita quando DATABASE_URL está ausente', () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/)
  })

  it('aceita um env válido e retorna tipado', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      WEB_ORIGIN: 'http://localhost:3001',
    })
    expect(env.DATABASE_URL).toContain('postgres://')
  })
})
```

- [ ] **Step 5: Rodar o teste e ver falhar**

Run: `bun --filter @quitto/api test`
Expected: FAIL — `Cannot find module '../src/env'`.

- [ ] **Step 6: Implementar `apps/api/src/env.ts`**

```ts
import { makeEnv } from '@quitto/shared'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: unknown = process.env): Env {
  return makeEnv(schema, source)
}

export const env = parseEnv()
```

> **Nota:** `export const env` executa a validação no import (falha cedo). Os testes chamam `parseEnv(obj)` com objetos controlados, então não dependem do `process.env`.

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `DATABASE_URL=postgres://u:p@localhost:5432/db BETTER_AUTH_SECRET=$(printf 'x%.0s' {1..32}) BETTER_AUTH_URL=http://localhost:3000 WEB_ORIGIN=http://localhost:3001 bun --filter @quitto/api test`
Expected: PASS (2 testes).

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/env.ts apps/api/tests/env.test.ts bun.lock
git commit -m "feat(api): validação de env com Zod (falha cedo)"
```

---

## Task 4: Banco — Drizzle + Postgres + schema do Better Auth + 1ª migração

**Files:**
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/schema.ts`
- Test: `apps/api/tests/db-health.test.ts`

- [ ] **Step 1: Criar `apps/api/src/db/schema.ts` (tabelas do Better Auth)**

```ts
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

> **Nota:** este é o schema padrão que o Better Auth espera (`user`/`session`/`account`/`verification`). As tabelas de domínio (contracts, installments...) entram na Fase 2.

- [ ] **Step 2: Criar `apps/api/src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

const queryClient = postgres(env.DATABASE_URL)
export const db = drizzle(queryClient, { schema })
export { schema }
```

- [ ] **Step 3: Criar `apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'
import { parseEnv } from './src/env'

const env = parseEnv()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
})
```

- [ ] **Step 4: Gerar a 1ª migração**

Run (com Postgres local de pé e `.env` carregado):
`cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5432/quitto BETTER_AUTH_SECRET=$(printf 'x%.0s' {1..32}) BETTER_AUTH_URL=http://localhost:3000 WEB_ORIGIN=http://localhost:3001 bun run db:generate`
Expected: cria `apps/api/drizzle/0000_*.sql` com as 4 tabelas.

- [ ] **Step 5: Aplicar a migração**

Run (mesmas envs): `bun run db:migrate`
Expected: "migrations applied"; tabelas criadas no Postgres.

- [ ] **Step 6: Escrever o teste de health do banco**

Create `apps/api/tests/db-health.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/client'

describe('db health', () => {
  it('responde a um SELECT 1', async () => {
    const rows = await db.execute(sql`select 1 as ok`)
    expect(rows[0]).toMatchObject({ ok: 1 })
  })
})
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run (com envs do Postgres local): `bun --filter @quitto/api test tests/db-health.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db apps/api/drizzle.config.ts apps/api/drizzle apps/api/tests/db-health.test.ts
git commit -m "feat(api): drizzle + postgres + schema do better-auth (1a migração)"
```

---

## Task 5: Better Auth como handler puro + app Elysia tipada (Spike do Eden, parte 1)

**Files:**
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Test: `apps/api/tests/ping.test.ts`

- [ ] **Step 1: Criar `apps/api/src/auth.ts` (instância Better Auth — handler puro)**

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, schema } from './db/client'
import { env } from './env'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [env.WEB_ORIGIN],
})
```

> **Nota da mitigação (eden#215):** vamos montar `auth.handler` como handler puro e **NÃO** usar a `.macro({ auth })` do Better Auth nas rotas tipadas pelo Eden — é a macro que apaga os tipos. A proteção de rotas (guard via `getSession`) entra na Fase 1, fora do caminho de tipos do Eden.

- [ ] **Step 2: Criar `apps/api/src/app.ts` (exporta `type App`)**

```ts
import { cors } from '@elysiajs/cors'
import { Elysia, t } from 'elysia'
import { auth } from './auth'
import { env } from './env'

export function buildApp() {
  return new Elysia({ prefix: '/api' })
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .get('/ping', () => ({ status: 'ok' as const, service: 'quitto-api' }), {
      response: t.Object({ status: t.Literal('ok'), service: t.String() }),
    })
}

export const app = buildApp()
export type App = typeof app
```

- [ ] **Step 3: Criar `apps/api/src/index.ts`**

```ts
import { app } from './app'

app.listen(3000)
// biome-ignore lint/suspicious/noConsole: log de inicialização do servidor
console.log(`🦊 API em ${app.server?.hostname}:${app.server?.port}`)
```

- [ ] **Step 4: Escrever o teste do ping via Eden (in-process)**

Create `apps/api/tests/ping.test.ts`:

```ts
import { treaty } from '@elysiajs/eden'
import { describe, expect, it } from 'bun:test'
import { app } from '../src/app'

const api = treaty(app)

describe('GET /api/ping', () => {
  it('retorna status ok tipado (não any)', async () => {
    const { data, error } = await api.api.ping.get()
    expect(error).toBeNull()
    expect(data).toEqual({ status: 'ok', service: 'quitto-api' })
    // prova de tipo: o campo abaixo só compila se `data` for tipado corretamente
    const status: 'ok' | undefined = data?.status
    expect(status).toBe('ok')
  })
})
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run (com envs do Postgres local): `bun --filter @quitto/api test tests/ping.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificar tipos (a prova do spike no back)**

Run: `bun --filter @quitto/api typecheck`
Expected: PASS — confirma que mesmo com `auth.handler` montado, a rota `/api/ping` é tipada e `data?.status` compila como `'ok'`.

- [ ] **Step 7: Subir o servidor e bater no endpoint (smoke)**

Run: `bun --filter @quitto/api dev` (em outro terminal) e então
`curl -s localhost:3000/api/ping`
Expected: `{"status":"ok","service":"quitto-api"}`. Encerre o dev (`Ctrl+C`).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/tests/ping.test.ts
git commit -m "feat(api): elysia app tipada + better-auth como handler puro"
```

---

## Task 6: Pacote `web` — Vite + React 19 + Tailwind + cliente Eden (Spike do Eden, parte 2)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/vercel.json`
- Test: `apps/web/tests/eden-types.test.ts`

- [ ] **Step 1: Criar `apps/web/package.json`**

```json
{
  "name": "@quitto/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3001",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@quitto/api": "workspace:*",
    "@quitto/shared": "workspace:*",
    "@elysiajs/eden": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/vite": "latest",
    "tailwindcss": "latest",
    "vite": "latest",
    "vitest": "latest",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "latest",
    "@biomejs/biome": "latest"
  }
}
```

- [ ] **Step 2: Criar `apps/web/tsconfig.json` (path para o tipo da API)**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "paths": { "@quitto/api": ["../api/src/app.ts"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Criar `apps/web/vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
```

> **Nota:** o `proxy` do Vite replica em DEV o mesmo efeito do `vercel.json` em PROD (mesma origem → cookie first-party).

- [ ] **Step 4: Criar `apps/web/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quitto</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Criar `apps/web/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Criar `apps/web/src/lib/api.ts` (cliente Eden — cross-package)**

```ts
import { treaty } from '@elysiajs/eden'
import type { App } from '@quitto/api'

// Mesma origem: o front chama '/api' (proxy do Vite em dev, vercel.json em prod).
export const api = treaty<App>(window.location.origin, {
  fetch: { credentials: 'include' },
})
```

- [ ] **Step 7: Criar `apps/web/src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from './lib/api'

export function App() {
  const [status, setStatus] = useState<string>('...')

  useEffect(() => {
    api.api.ping.get().then(({ data }) => {
      if (data) setStatus(`${data.service}: ${data.status}`)
    })
  }, [])

  return (
    <main className="tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-bg-stone-50">
      <p className="tw-text-stone-800">Quitto — {status}</p>
    </main>
  )
}
```

> **Nota:** o prefixo `tw-` virá da config do Tailwind compartilhada nas próximas fases; por ora as classes apenas demonstram a renderização.

- [ ] **Step 8: Criar `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// biome-ignore lint/style/noNonNullAssertion: #root existe no index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Criar `apps/web/vercel.json` (proxy de mesma origem em prod)**

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://quitto-api.fly.dev/api/:path*" }
  ]
}
```

> **Nota:** trocar `quitto-api.fly.dev` pelo host real do app no Fly quando ele existir (Task 7).

- [ ] **Step 10: Escrever o teste que prova que o Eden NÃO retorna `any` (o spike)**

Create `apps/web/tests/eden-types.test.ts`:

```ts
import { treaty } from '@elysiajs/eden'
import { expectTypeOf, it } from 'vitest'
import type { App } from '@quitto/api'

it('Eden infere o tipo da resposta cross-package (mitigação eden#215)', () => {
  const api = treaty<App>('http://localhost:3000')
  type PingResponse = Awaited<ReturnType<typeof api.api.ping.get>>['data']
  // Se o Better Auth quebrasse os tipos, isto seria `any` e o teste falharia.
  expectTypeOf<PingResponse>().not.toBeAny()
  expectTypeOf<NonNullable<PingResponse>>().toEqualTypeOf<{ status: 'ok'; service: string }>()
})
```

- [ ] **Step 11: Instalar e rodar o teste de tipos**

Run: `bun install && bun --filter @quitto/web test`
Expected: PASS — **prova central do spike**: o tipo cruzou o pacote sem virar `any`.

- [ ] **Step 12: Typecheck + build do front**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build`
Expected: ambos PASS; gera `apps/web/dist`.

- [ ] **Step 13: Smoke manual (front + back juntos)**

Run: suba a API (`bun --filter @quitto/api dev`) e o front (`bun --filter @quitto/web dev`), abra `http://localhost:3001`.
Expected: a página mostra "Quitto — quitto-api: ok" (front chamou `/api/ping` via proxy). Encerre ambos.

- [ ] **Step 14: Commit**

```bash
git add apps/web bun.lock
git commit -m "feat(web): vite+react+eden client; spike prova tipos cross-package"
```

---

## Task 7: Configs de deploy (Fly + Vercel)

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/fly.toml`
- Create: `apps/api/.dockerignore`

- [ ] **Step 1: Criar `apps/api/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN bun install --frozen-lockfile

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
```

> **Nota:** build context é a **raiz do monorepo** (precisa do `bun.lock` e do `packages/shared`). O deploy no Fly usa `--dockerfile apps/api/Dockerfile` a partir da raiz.

- [ ] **Step 2: Criar `apps/api/.dockerignore`**

```
node_modules
**/node_modules
**/dist
.git
apps/web
```

- [ ] **Step 3: Criar `apps/api/fly.toml`**

```toml
app = "quitto-api"
primary_region = "gru"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  method = "get"
  path = "/api/ping"
  interval = "30s"
  timeout = "5s"
```

- [ ] **Step 4: Validar o build da imagem localmente**

Run (na raiz do repo): `docker build -f apps/api/Dockerfile -t quitto-api .`
Expected: build conclui sem erro (imagem criada).

- [ ] **Step 5: Commit**

```bash
git add apps/api/Dockerfile apps/api/.dockerignore apps/api/fly.toml
git commit -m "chore(api): Dockerfile + fly.toml para deploy no Fly"
```

---

## Task 8: Tooling — Biome + Ultracite + Lefthook

**Files:**
- Create: `biome.jsonc`
- Create: `lefthook.yml`
- Modify: `package.json` (root: devDeps + hook install)

- [ ] **Step 1: Instalar Biome, Ultracite e Lefthook na raiz**

Run: `bun add -D -w @biomejs/biome ultracite lefthook`
Expected: adicionados ao `devDependencies` da raiz.

- [ ] **Step 2: Criar `biome.jsonc`**

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["ultracite"],
  "files": {
    "includes": ["apps/**/src/**", "apps/**/tests/**", "packages/**/src/**"]
  }
}
```

> **Nota:** Ultracite é um preset de regras estritas do Biome. Se a versão instalada expuser o preset com outro nome, rode `bunx ultracite init` e mantenha o `extends` que ele gerar.

- [ ] **Step 3: Criar `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json,jsonc,css}"
      run: bunx biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    typecheck:
      run: bun run typecheck
```

- [ ] **Step 4: Instalar os git hooks**

Run: `bunx lefthook install`
Expected: "lefthook installed"; cria `.git/hooks/pre-commit`.

- [ ] **Step 5: Verificar lint e typecheck em todo o monorepo**

Run: `bun run lint && bun run typecheck`
Expected: ambos PASS (corrija o que o Biome apontar).

- [ ] **Step 6: Testar o hook (deve rodar no commit)**

```bash
git add biome.jsonc lefthook.yml package.json bun.lock
git commit -m "chore: biome + ultracite + lefthook no pre-commit"
```
Expected: o hook roda biome + typecheck antes de concluir o commit.

---

## Task 9: CI (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: quitto
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/quitto
      BETTER_AUTH_SECRET: ci-secret-ci-secret-ci-secret-ci-secret
      BETTER_AUTH_URL: http://localhost:3000
      WEB_ORIGIN: http://localhost:3001
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun --filter @quitto/api run db:migrate
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test
      - run: bun run build
```

- [ ] **Step 2: Validar a sintaxe do workflow**

Run: `bunx --bun yaml-lint .github/workflows/ci.yml 2>/dev/null || cat .github/workflows/ci.yml`
Expected: YAML válido (sem erro de parse).

- [ ] **Step 3: Commit e push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint + typecheck + test + build com Postgres de serviço"
```

- [ ] **Step 4: Verificar o CI no GitHub**

Após `git push` (quando o remote existir), confirmar que o workflow **passa verde** na aba Actions.
Expected: todos os passos verdes — encerra a Fase 0.

---

## Self-Review (cobertura do spec da Fase 0)

- **Monorepo Bun + Turborepo:** Tasks 1, 8 ✅
- **`shared` com env helper + tipo de erro:** Task 2 ✅
- **API Elysia + validação de env (Zod, falha cedo):** Tasks 3, 5 ✅
- **Drizzle + Postgres + migração versionada + seed/health:** Task 4 ✅
- **Better Auth desacoplado (handler puro, sem macro nos tipos do Eden):** Task 5 ✅
- **Spike do Eden cross-package (data ≠ any, com auth montado):** Tasks 5 (back) e 6 (front) ✅
- **Proxy de mesma origem (vercel.json + proxy do Vite em dev):** Tasks 6 ✅
- **tsconfig strict + Biome/Ultracite + Lefthook (biome+typecheck):** Tasks 1, 8 ✅
- **Configs de deploy (Dockerfile/fly.toml):** Task 7 ✅
- **CI (lint+typecheck+test+build com Postgres):** Task 9 ✅
- **Fallback documentado:** se o teste da Task 6 (Step 11) **falhar** (Eden virar `any`), parar e trocar a estratégia para cliente tipado via OpenAPI (Elysia já gera o schema) antes de seguir para a Fase 1.
