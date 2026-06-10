# Fase 1 — Autenticação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login funcional ponta a ponta — Google OAuth (prod) + e-mail/senha (dev/testes) via Better Auth, rota protegida `GET /api/me`, e no front: TanStack Router + Query, shadcn/ui com tema B2, tela de login e app shell (sidebar) com logout.

**Architecture:** O Better Auth segue **montado como handler puro** (sem a macro que quebra o Eden). As rotas de negócio ficam num grupo Elysia com prefixo `/api`; a proteção usa um helper `requireAuth(headers)` chamado **dentro do handler** (sem `derive`/`macro`, pra não poluir os tipos do Eden). O front usa o client do Better Auth (`createAuthClient`) para auth e o Eden só para negócio; rotas protegidas no TanStack Router redirecionam para `/login` quando não há sessão.

**Tech Stack:** Better Auth 1.6 (Google + emailAndPassword), Elysia 1.4, Eden 1.4, Drizzle 0.45; React 19, TanStack Router + TanStack Query v5, Tailwind v4 + shadcn/ui, Vite 8.

> **Convenção de idioma (spec §9):** código/identificadores/rotas/comentários em inglês; conteúdo visível ao usuário em pt-BR; docs e commits em pt-BR.

> **Pré-requisitos:** Fase 0 concluída (branch `develop`). Postgres local de pé (`docker start quitto-pg` ou o `docker run` da Fase 0). Variáveis de ambiente da Fase 0 carregadas. Credenciais Google **não são necessárias** para concluir esta fase — o fluxo de dev/testes usa e-mail/senha; o Google é wired por env vars opcionais.

> **Git:** crie a branch `feat/fase-1-autenticacao` a partir de `develop`. Ao final, com tudo verde, faça merge em `develop`.

---

## Estrutura de arquivos (novos/alterados)

```
apps/api/
├─ src/
│  ├─ env.ts                    # + GOOGLE_CLIENT_ID/SECRET (opcionais)
│  ├─ auth.ts                   # + socialProviders.google (condicional) + basePath
│  ├─ app.ts                    # reestrutura: root app + mount(auth) + grupo /api
│  ├─ lib/
│  │  ├─ errors.ts              # AppError + subclasses + toErrorBody (novo)
│  │  └─ session.ts             # requireAuth(headers) (novo)
│  └─ modules/
│     └─ me.ts                  # plugin Elysia: GET /api/me protegida (novo)
└─ tests/
   ├─ auth-routes.test.ts       # auth resolve + ping coexiste (novo)
   └─ me.test.ts                # /me sem sessão (401) e com sessão (novo)

apps/web/
├─ package.json                 # + tanstack router/query, better-auth, shadcn deps
├─ components.json              # shadcn (novo)
├─ src/
│  ├─ index.css                 # + tema B2 (tokens shadcn)
│  ├─ main.tsx                  # providers: QueryClient + RouterProvider
│  ├─ lib/
│  │  ├─ auth-client.ts         # createAuthClient (novo)
│  │  ├─ query.ts               # QueryClient (novo)
│  │  └─ utils.ts               # cn() do shadcn (novo)
│  ├─ components/ui/            # shadcn: button, input, label, card (novo)
│  ├─ components/app-sidebar.tsx# sidebar do shell (novo)
│  ├─ routes/
│  │  ├─ root.tsx               # rota raiz (novo)
│  │  ├─ login.tsx              # tela de login (novo)
│  │  ├─ protected.tsx          # layout protegido (guard) + sidebar (novo)
│  │  └─ dashboard.tsx          # placeholder protegido (novo)
│  └─ router.tsx                # route tree + createRouter (novo)
└─ .env.example                 # (raiz) + GOOGLE_* opcionais
```

> O `apps/web/src/app.tsx` da Fase 0 (página de ping) será **removido** — o `main.tsx` passa a renderizar o `RouterProvider`.

---

## Task 1: Env — adicionar Google (opcional) e atualizar `.env.example`

**Files:**
- Modify: `apps/api/src/env.ts`
- Modify: `.env.example`
- Test: `apps/api/tests/env.test.ts`

- [ ] **Step 1: Adicionar teste para Google opcional**

Edite `apps/api/tests/env.test.ts` e acrescente dentro do `describe('parseEnv', ...)`:

```ts
  it('accepts optional Google credentials', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      WEB_ORIGIN: 'http://localhost:3001',
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
    })
    expect(env.GOOGLE_CLIENT_ID).toBe('gid')
  })

  it('is valid without Google credentials (dev)', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      WEB_ORIGIN: 'http://localhost:3001',
    })
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
  })
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `bun --filter @quitto/api test tests/env.test.ts`
Expected: FAIL — `GOOGLE_CLIENT_ID` não existe no tipo/retorno.

- [ ] **Step 3: Adicionar os campos opcionais ao schema**

Em `apps/api/src/env.ts`, dentro do `z.object({ ... })`, adicione após `WEB_ORIGIN`:

```ts
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `bun --filter @quitto/api test tests/env.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Atualizar `.env.example`**

Em `.env.example`, na seção `# API`, adicione:

```bash
# Google OAuth (opcional em dev; necessário para login social em prod)
# Redirect URI no Google Cloud: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/env.ts apps/api/tests/env.test.ts .env.example
git commit -m "feat(api): env opcional para Google OAuth"
```

---

## Task 2: Better Auth — habilitar Google e fixar basePath

**Files:**
- Modify: `apps/api/src/auth.ts`

- [ ] **Step 1: Atualizar `apps/api/src/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db/client";
import { env } from "./env";

const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: googleProvider,
  trustedOrigins: [env.WEB_ORIGIN],
});
```

- [ ] **Step 2: Typecheck**

Run: `bun --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth.ts
git commit -m "feat(api): habilita Google OAuth (condicional) + basePath /api/auth"
```

---

## Task 3: Reestruturar `app.ts` para as rotas de auth resolverem (+ verificar)

> **Por quê:** na Fase 0 o app tinha `prefix: '/api'` envolvendo o `.mount(auth.handler)`, o que faria as rotas internas do Better Auth (`/api/auth/*`) não baterem. Aqui o auth é montado no app **raiz** (sem prefixo) e as rotas de negócio vão para um grupo `/api`.

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/auth-routes.test.ts`

- [ ] **Step 1: Reescrever `apps/api/src/app.ts`**

```ts
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { env } from "./env";

const apiRoutes = new Elysia({ prefix: "/api" }).get(
  "/ping",
  () => ({ status: "ok" as const, service: "quitto-api" }),
  { response: t.Object({ status: t.Literal("ok"), service: t.String() }) },
);

export function buildApp() {
  return new Elysia()
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .use(apiRoutes);
}

export const app = buildApp();
export type App = typeof app;
```

- [ ] **Step 2: Escrever o teste de coexistência (auth + ping)**

Create `apps/api/tests/auth-routes.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("routing", () => {
  it("ainda serve /api/ping (negócio)", async () => {
    const res = await app.handle(new Request("http://localhost/api/ping"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "quitto-api" });
  });

  it("serve as rotas do Better Auth em /api/auth/*", async () => {
    // endpoint público do Better Auth: lista de erros/ok-check de sessão
    const res = await app.handle(
      new Request("http://localhost/api/auth/get-session", {
        headers: { cookie: "" },
      }),
    );
    // sem sessão, retorna 200 com null (não 404 — prova que a rota existe)
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run (com Postgres + envs): `bun --filter @quitto/api test tests/auth-routes.test.ts`
Expected: PASS. Se o segundo teste der 404, o mount/basePath está errado — revise a Task 2/3 antes de prosseguir.

- [ ] **Step 4: Confirmar que o spike do Eden continua válido**

Run: `bun --filter @quitto/web test && bun --filter @quitto/api typecheck`
Expected: PASS — `/api/ping` segue tipado no Eden após a reestruturação.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/tests/auth-routes.test.ts
git commit -m "refactor(api): monta auth no app raiz + grupo /api (rotas de auth resolvem)"
```

---

## Task 4: Erros — `AppError` + envelope `onError`

**Files:**
- Create: `apps/api/src/lib/errors.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Criar `apps/api/src/lib/errors.ts`**

```ts
import type { ApiErrorBody } from "@quitto/shared";

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(args: {
    code: string;
    httpStatus: number;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "AppError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super({ code: "UNAUTHORIZED", httpStatus: 401, message });
  }
}

export function toErrorBody(error: AppError): ApiErrorBody {
  return {
    error: { code: error.code, message: error.message, details: error.details },
  };
}
```

> **Nota:** `message` aqui é pt-BR porque pode ser exibida ao usuário; `code` é inglês (enum estável).

- [ ] **Step 2: Registrar `onError` no `app.ts`**

Em `apps/api/src/app.ts`, adicione o import e o handler de erro. O `buildApp` fica:

```ts
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { env } from "./env";
import { AppError, toErrorBody } from "./lib/errors";

const apiRoutes = new Elysia({ prefix: "/api" }).get(
  "/ping",
  () => ({ status: "ok" as const, service: "quitto-api" }),
  { response: t.Object({ status: t.Literal("ok"), service: t.String() }) },
);

export function buildApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.httpStatus;
        return toErrorBody(error);
      }
    })
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .use(apiRoutes);
}

export const app = buildApp();
export type App = typeof app;
```

- [ ] **Step 3: Typecheck + testes existentes**

Run: `bun --filter @quitto/api typecheck && bun --filter @quitto/api test`
Expected: PASS (nada quebrado).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/src/app.ts
git commit -m "feat(api): AppError + envelope de erro no onError"
```

---

## Task 5: Guard de sessão + rota protegida `GET /api/me` (TDD)

**Files:**
- Create: `apps/api/src/lib/session.ts`
- Create: `apps/api/src/modules/me.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/me.test.ts`

- [ ] **Step 1: Criar `apps/api/src/lib/session.ts`**

```ts
import { auth } from "../auth";
import { UnauthorizedError } from "./errors";

/** Lê a sessão a partir dos headers; lança 401 se ausente. Sem macro/derive (mantém os tipos do Eden limpos). */
export async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new UnauthorizedError();
  }
  return { user: session.user, session: session.session };
}
```

- [ ] **Step 2: Criar `apps/api/src/modules/me.ts`**

```ts
import { Elysia, t } from "elysia";
import { requireAuth } from "../lib/session";

export const meModule = new Elysia({ prefix: "/api" }).get(
  "/me",
  async ({ request }) => {
    const { user } = await requireAuth(request.headers);
    return { id: user.id, name: user.name, email: user.email, image: user.image ?? null };
  },
  {
    response: t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
      image: t.Union([t.String(), t.Null()]),
    }),
  },
);
```

- [ ] **Step 3: Registrar o módulo no `app.ts`**

Em `apps/api/src/app.ts`, importe e use o módulo:

```ts
import { meModule } from "./modules/me";
```

E no `buildApp`, adicione `.use(meModule)` após `.use(apiRoutes)`:

```ts
    .use(apiRoutes)
    .use(meModule);
```

- [ ] **Step 4: Escrever o teste de `/api/me` (sem e com sessão)**

Create `apps/api/tests/me.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

const unique = `t${Date.now()}@example.com`;

async function signUpAndGetCookie(): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email: unique, password: "password123" }),
    }),
  );
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  // pega só o par chave=valor do primeiro cookie
  return (setCookie as string).split(";")[0] as string;
}

describe("GET /api/me", () => {
  it("retorna 401 sem sessão", async () => {
    const res = await app.handle(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("retorna o usuário com sessão válida", async () => {
    const cookie = await signUpAndGetCookie();
    const res = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(unique);
  });
});
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run (com Postgres + envs): `bun --filter @quitto/api test tests/me.test.ts`
Expected: PASS (2 testes). Se o sign-up retornar != 200, confirme que `emailAndPassword` está habilitado (Task 2) e o Postgres migrado.

- [ ] **Step 6: Suite + typecheck completos da API**

Run: `bun --filter @quitto/api test && bun --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/session.ts apps/api/src/modules/me.ts apps/api/src/app.ts apps/api/tests/me.test.ts
git commit -m "feat(api): guard de sessão (requireAuth) + GET /api/me protegida"
```

---

## Task 6: Web — TanStack Query + client do Better Auth

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/query.ts`
- Create: `apps/web/src/lib/auth-client.ts`

- [ ] **Step 1: Instalar dependências do front**

Run: `cd apps/web && bun add @tanstack/react-router @tanstack/react-query better-auth && bun add -D @tanstack/router-devtools`
Expected: adicionadas ao `apps/web/package.json`.

- [ ] **Step 2: Criar `apps/web/src/lib/query.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});
```

- [ ] **Step 3: Criar `apps/web/src/lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react";

// Mesma origem (proxy): o client fala com /api/auth/* no próprio host.
export const authClient = createAuthClient({ baseURL: window.location.origin });

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 4: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/query.ts apps/web/src/lib/auth-client.ts bun.lock
git commit -m "feat(web): TanStack Query + client do Better Auth"
```

---

## Task 7: Web — Tailwind v4 + shadcn/ui com tema B2

> **Diretriz de UI (spec §5):** ao montar componentes visuais, use a skill de design (frontend-design / ui-ux-pro-max) aterrada na identidade **B2 (teal + areia)**. Os tokens abaixo já fixam essa identidade.

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Modify: `apps/web/src/index.css`
- Create: `apps/web/src/components/ui/{button,input,label,card}.tsx`

- [ ] **Step 1: Instalar deps do shadcn (Tailwind v4 já está instalado)**

Run: `cd apps/web && bun add class-variance-authority clsx tailwind-merge lucide-react && bun add -D tw-animate-css`
Expected: instaladas.

- [ ] **Step 2: Criar `apps/web/src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Definir o tema B2 em `apps/web/src/index.css`**

Substitua o conteúdo por (tokens em OKLCH; teal como `--primary`, areia como `--background`):

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

:root {
  --radius: 0.75rem;
  --background: oklch(0.98 0.01 85);      /* areia */
  --foreground: oklch(0.27 0.03 60);      /* marrom-acinzentado escuro */
  --card: oklch(0.99 0.008 85);
  --card-foreground: var(--foreground);
  --primary: oklch(0.52 0.09 175);        /* teal #0f766e aprox */
  --primary-foreground: oklch(0.98 0.01 85);
  --muted: oklch(0.95 0.012 85);
  --muted-foreground: oklch(0.55 0.02 70);
  --border: oklch(0.9 0.015 80);
  --input: oklch(0.9 0.015 80);
  --ring: oklch(0.52 0.09 175);
  --destructive: oklch(0.58 0.22 27);     /* vermelho */
}

@layer base {
  * { border-color: var(--color-border); }
  body { background-color: var(--color-background); color: var(--color-foreground); }
}
```

- [ ] **Step 4: Criar `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/index.css", "baseColor": "stone", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

- [ ] **Step 5: Adicionar o alias `@` no Vite e no tsconfig**

Em `apps/web/vite.config.ts`, adicione `resolve.alias`:

```ts
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  server: {
    port: 3001,
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
  },
});
```

Em `apps/web/tsconfig.json`, adicione ao `paths` (mantendo o `@quitto/api` existente):

```json
    "paths": { "@quitto/api": ["../api/src/app.ts"], "@/*": ["./src/*"] }
```

- [ ] **Step 6: Adicionar componentes shadcn**

Run: `cd apps/web && bunx shadcn@latest add button input label card`
Expected: cria `src/components/ui/{button,input,label,card}.tsx`. Se o CLI pedir confirmação de config, aceite a detectada (Tailwind v4, css `src/index.css`).

- [ ] **Step 7: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/index.css apps/web/src/components/ui apps/web/vite.config.ts apps/web/tsconfig.json apps/web/package.json bun.lock
git commit -m "feat(web): tailwind v4 + shadcn/ui com tema B2 (teal+areia)"
```

---

## Task 8: Web — Login (Google + e-mail/senha)

**Files:**
- Create: `apps/web/src/routes/login.tsx`

- [ ] **Step 1: Criar `apps/web/src/routes/login.tsx`**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

export function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const action =
      mode === "signin"
        ? signIn.email({ email, password, callbackURL: "/" })
        : signUp.email({ name, email, password, callbackURL: "/" });
    const { error: err } = await action;
    setLoading(false);
    if (err) {
      setError("Não foi possível entrar. Verifique os dados e tente novamente.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-bold text-foreground">Quitto</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full"
          onClick={() => signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Continuar com Google
        </Button>

        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
        </button>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/login.tsx
git commit -m "feat(web): tela de login (Google + e-mail/senha)"
```

---

## Task 9: Web — App shell (sidebar) + logout

**Files:**
- Create: `apps/web/src/components/app-sidebar.tsx`
- Create: `apps/web/src/routes/dashboard.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/app-sidebar.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { signOut, useSession } from "@/lib/auth-client";

export function AppSidebar() {
  const { data: session } = useSession();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card p-4">
      <span className="mb-6 text-lg font-extrabold text-primary">◷ Quitto</span>
      <nav className="flex flex-col gap-1 text-sm">
        <Link
          to="/"
          className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted [&.active]:bg-primary/10 [&.active]:font-semibold [&.active]:text-primary"
        >
          Dashboard
        </Link>
      </nav>
      <div className="mt-auto border-t border-border pt-3">
        <p className="mb-2 truncate text-sm text-foreground">{session?.user.name ?? "..."}</p>
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => signOut().then(() => { window.location.href = "/login"; })}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Criar `apps/web/src/routes/dashboard.tsx`**

```tsx
export function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Em breve: seus contratos.</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS (pode falhar por falta do router — será resolvido na Task 10; se falhar só por `@tanstack/react-router` ainda não usado em rota, prossiga para a Task 10 e rode o typecheck lá).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/src/routes/dashboard.tsx
git commit -m "feat(web): app shell (sidebar) + logout e página de dashboard"
```

---

## Task 10: Web — Roteamento (TanStack Router) com guard + providers

**Files:**
- Create: `apps/web/src/routes/root.tsx`
- Create: `apps/web/src/routes/protected.tsx`
- Create: `apps/web/src/router.tsx`
- Modify: `apps/web/src/main.tsx`
- Delete: `apps/web/src/app.tsx`

- [ ] **Step 1: Criar `apps/web/src/routes/root.tsx`**

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({ component: () => <Outlet /> });
```

- [ ] **Step 2: Criar `apps/web/src/routes/protected.tsx` (layout com guard)**

```tsx
import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@/lib/auth-client";
import { rootRoute } from "./root";

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  ),
});
```

- [ ] **Step 3: Criar `apps/web/src/router.tsx` (route tree + createRouter)**

```tsx
import { createRoute, createRouter } from "@tanstack/react-router";
import { DashboardPage } from "./routes/dashboard";
import { LoginPage } from "./routes/login";
import { protectedRoute } from "./routes/protected";
import { rootRoute } from "./routes/root";

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([dashboardRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 4: Reescrever `apps/web/src/main.tsx`**

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { queryClient } from "./lib/query";
import { router } from "./router";

// biome-ignore lint/style/noNonNullAssertion: #root exists in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: Remover o `app.tsx` da Fase 0**

Run: `git rm apps/web/src/app.tsx`
Expected: arquivo removido.

- [ ] **Step 6: Typecheck + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build`
Expected: ambos PASS.

- [ ] **Step 7: Verificar o spike do Eden ainda passa**

Run: `bun --filter @quitto/web test`
Expected: PASS (o teste de tipos cross-package continua válido).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes apps/web/src/router.tsx apps/web/src/main.tsx
git commit -m "feat(web): rotas TanStack (login público + layout protegido com guard)"
```

---

## Task 11: Verificação end-to-end manual (dev) + fechar a fase

**Files:** (nenhum — verificação)

- [ ] **Step 1: Subir API e Web**

Run (Postgres de pé): em um terminal `bun --filter @quitto/api dev`; em outro `bun --filter @quitto/web dev`.

- [ ] **Step 2: Fluxo de cadastro/login (e-mail/senha)**

Abra `http://localhost:3001`. Esperado: redireciona para `/login` (guard). Crie uma conta (modo "Cadastre-se"); após sucesso, vai para `/` e mostra o **Dashboard** com a **sidebar** e o nome do usuário.

- [ ] **Step 3: Logout e proteção**

Clique em **Sair**. Esperado: volta para `/login`. Tente abrir `http://localhost:3001/` diretamente → redireciona para `/login`.

- [ ] **Step 4: Sessão persiste (cookie first-party via proxy)**

Faça login de novo e recarregue a página. Esperado: continua logado (sessão persistida pelo cookie no proxy do Vite). Encerre os dev servers.

- [ ] **Step 5: Suite completa do monorepo**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 6: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff feat/fase-1-autenticacao -m "Merge da Fase 1 (autenticação) em develop"
```

- [ ] **Step 7: Atualizar o ROADMAP**

Em `docs/superpowers/ROADMAP.md`, marque a Fase 1 como **concluído** e faça commit:

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca a Fase 1 como concluída no roadmap"
```

---

## Self-Review (cobertura)

- **Google OAuth (condicional por env):** Tasks 1, 2 ✅
- **e-mail/senha (dev/testes):** já habilitado na Fase 0; exercitado nas Tasks 5, 8, 11 ✅
- **Rotas de auth resolvendo (correção do mount):** Task 3 ✅
- **Guard de sessão sem macro/derive (mantém tipos do Eden):** Task 5 ✅
- **Rota protegida `GET /api/me` tipada:** Task 5 ✅
- **Envelope de erro com `code`:** Task 4 ✅
- **TanStack Query + client Better Auth:** Task 6 ✅
- **Tailwind v4 + shadcn + tema B2:** Task 7 ✅
- **Tela de login (Google + e-mail/senha):** Task 8 ✅
- **App shell (sidebar) + logout:** Task 9 ✅
- **TanStack Router com rota pública + protegida (guard → /login):** Task 10 ✅
- **Verificação e2e manual + merge:** Task 11 ✅
- **Convenção de idioma (código inglês, UI pt-BR):** aplicada em todo o plano ✅
- **Fora de escopo (confirmado):** E2E Playwright (Fase 7), contratos/parcelas (Fase 2).

> **Risco/observação:** a Task 3 valida empiricamente o roteamento do mount do Better Auth (ponto não exercitado na Fase 0). Se o teste de `/api/auth/get-session` retornar 404, ajustar o mount (ex.: `basePath` ou caminho do `.mount`) antes de prosseguir — não seguir com auth quebrado.
