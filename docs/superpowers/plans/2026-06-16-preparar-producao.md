# Primeiro Deploy de Produção (v0.1.0) — Runbook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Os passos usam checkbox (`- [ ]`).
>
> **Natureza híbrida:** a **Task 1** é mudança de código/config (Claude executa). As **Tasks 2–10** são **operacionais** — só **você** executa (criar contas, `fly`/`vercel`/`neon` CLIs, dashboards). Para cada passo ops há **comando exato + critério de aceite**; quando der erro, **cole a saída** e o Claude ajuda a destravar (skill systematic-debugging).

**Goal:** Publicar o MVP do Quitto em produção, uma vez, na mão, validando o caminho crítico ponta a ponta em `https://usequitto.vercel.app`.

**Architecture:** Web (Vercel, SPA same-origin) → rewrite `/api/*` (`vercel.json`) → API (Fly, Elysia, porta 3000) → Neon (Postgres) + R2 (storage). Cookie de sessão first-party no domínio da Vercel via proxy.

**Tech Stack:** Bun + Elysia + Drizzle + Better Auth (API), React + Vite (web), Fly.io, Vercel, Neon, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-06-16-preparar-producao-design.md`

**Pré-requisitos seus:** contas em GitHub, Fly.io, Vercel, Neon, Cloudflare; CLIs `flyctl`, `vercel`, `gh` (ou `git` + web), `openssl`. Credenciais Google OAuth (já usadas em dev).

**Git:** branch `chore/prep-prod-config` a partir de `develop` (Task 1). Tasks ops não geram commit (exceto a tag, já criada).

---

### Task 1: Mudanças de config no repositório (Claude)

**Files:**
- Modify: `apps/api/fly.toml:1`
- Modify: `apps/web/vercel.json:3`
- Verify (sem mudança): `apps/api/src/lib/storage.ts`

- [ ] **Step 1: Criar a branch**

```bash
git checkout develop && git checkout -b chore/prep-prod-config
```

- [ ] **Step 2: Renomear o app do Fly**

Em `apps/api/fly.toml`, trocar a primeira linha:

```toml
app = "usequitto-api"
```

- [ ] **Step 3: Apontar o rewrite do web pro app novo**

Em `apps/web/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://usequitto-api.fly.dev/api/:path*" }
  ]
}
```

- [ ] **Step 4: Confirmar que `storage.ts` é compatível com R2 (sem mudança)**

`forcePathStyle: true` (linha 51) funciona com R2 — o endpoint `https://<account_id>.r2.cloudflarestorage.com` aceita path-style e presigned URLs. **Nenhuma alteração necessária.** Só registre que foi verificado.

- [ ] **Step 5: Verificar build/typecheck (nada quebrou)**

Run: `bun run typecheck && bun run build`
Expected: ambos verdes (as mudanças são só config).

- [ ] **Step 6: Commit, merge na develop e fast-forward na main**

```bash
git add apps/api/fly.toml apps/web/vercel.json
git commit -m "chore: aponta fly/vercel para usequitto-api (prep prod)"
git checkout develop && git merge --ff-only chore/prep-prod-config
git checkout main && git merge --ff-only develop
git checkout develop
```

---

### Task 2: Remote no GitHub + push (ops)

- [ ] **Step 1: Criar o repositório remoto**

Via CLI: `gh repo create quitto --private --source=. --remote=origin`
(ou crie pela web e rode `git remote add origin git@github.com:<voce>/quitto.git`)

- [ ] **Step 2: Subir branches e tag**

```bash
git push -u origin develop
git push origin main
git push origin v0.1.0
```

- [ ] **Aceite:** `git remote -v` mostra `origin`; no GitHub aparecem `develop`, `main` e a tag `v0.1.0`.

---

### Task 3: Banco de produção no Neon (ops)

- [ ] **Step 1:** Criar um projeto no Neon (região mais próxima do Fly `gru` — ex.: AWS `sa-east-1` São Paulo, ou a mais próxima disponível).
- [ ] **Step 2:** Copiar a **connection string pooled** (endpoint com `-pooler`), formato `postgres://user:pass@ep-xxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require`.
- [ ] **Aceite:** você tem a `DATABASE_URL` pooled em mãos (guarde com segurança; não commite).

---

### Task 4: Rodar as migrations no Neon (ops)

O `drizzle.config.ts` chama `parseEnv()`, que exige 4 variáveis mesmo só pra migrar. Rode da pasta `apps/api`, passando-as inline (sintaxe `env` funciona no fish):

- [ ] **Step 1: Aplicar as migrations**

```bash
cd apps/api
env DATABASE_URL='<sua-DATABASE_URL-pooled-do-neon>' \
    BETTER_AUTH_SECRET='migracao-placeholder-32-caracteres-ok' \
    BETTER_AUTH_URL='https://usequitto.vercel.app' \
    WEB_ORIGIN='https://usequitto.vercel.app' \
    bun run db:migrate
cd ../..
```

(O `BETTER_AUTH_SECRET` aqui é só pra passar a validação do `parseEnv`; o `migrate` usa apenas `DATABASE_URL`. O secret de verdade é gerado na Task 7.)

- [ ] **Aceite:** saída lista as 9 migrations aplicadas, sem erro. No painel do Neon, as tabelas (`user`, `session`, `contract`, `installment`, etc.) aparecem.

---

### Task 5: Bucket R2 + token + CORS (ops)

- [ ] **Step 1:** No Cloudflare R2, criar bucket **privado** `quitto-proofs`.
- [ ] **Step 2:** Criar **API Token do R2** com permissão de leitura+escrita de objeto no bucket → anote `Access Key ID` e `Secret Access Key`.
- [ ] **Step 3:** Anotar o **endpoint S3**: `https://<account_id>.r2.cloudflarestorage.com`.
- [ ] **Step 4: Configurar CORS do bucket** (Settings → CORS Policy):

```json
[
  {
    "AllowedOrigins": ["https://usequitto.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

- [ ] **Aceite:** bucket criado, token gerado, endpoint anotado, CORS salvo com a origem da Vercel. (Sem isso, o upload do comprovante falha calado no Step 6 do smoke.)

---

### Task 6: Redirect URI do Google em produção (ops)

- [ ] **Step 1:** No Google Cloud Console → APIs & Services → Credentials → seu OAuth Client → **Authorized redirect URIs**, adicionar:

```
https://usequitto.vercel.app/api/auth/callback/google
```

- [ ] **Aceite:** o redirect de prod está salvo (mantenha também o de localhost). Tenha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` à mão.

---

### Task 7: Gerar o BETTER_AUTH_SECRET (ops)

- [ ] **Step 1:**

```bash
openssl rand -base64 48
```

- [ ] **Aceite:** você tem uma string ≥32 chars guardada (será o `BETTER_AUTH_SECRET` de prod).

---

### Task 8: App + secrets + deploy no Fly (ops)

- [ ] **Step 1: Login e criação do app**

```bash
fly auth login
fly apps create usequitto-api
```

(Se `usequitto-api` estiver tomado no Fly, escolha outro nome e **volte na Task 1** pra ajustar `fly.toml` + `vercel.json`.)

- [ ] **Step 2: Setar os secrets** (todos de uma vez, com seus valores reais):

```bash
fly secrets set --config apps/api/fly.toml \
  DATABASE_URL='<neon-pooled>' \
  BETTER_AUTH_SECRET='<openssl-da-task-7>' \
  BETTER_AUTH_URL='https://usequitto.vercel.app' \
  WEB_ORIGIN='https://usequitto.vercel.app' \
  GOOGLE_CLIENT_ID='<google-client-id>' \
  GOOGLE_CLIENT_SECRET='<google-client-secret>' \
  S3_ENDPOINT='https://<account_id>.r2.cloudflarestorage.com' \
  S3_REGION='auto' \
  S3_BUCKET='quitto-proofs' \
  S3_ACCESS_KEY_ID='<r2-access-key>' \
  S3_SECRET_ACCESS_KEY='<r2-secret-key>'
```

- [ ] **Step 3: Deploy a partir da RAIZ do monorepo** (build context precisa da raiz — o `Dockerfile` faz `COPY package.json bun.lock` + `packages/shared`):

```bash
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

- [ ] **Aceite:** `curl https://usequitto-api.fly.dev/api/ping` responde 200; `fly status --config apps/api/fly.toml` mostra a máquina rodando e o healthcheck verde.

🔎 **Gotcha:** se rodar `fly deploy` de dentro de `apps/api`, o build falha no `COPY package.json bun.lock` (context errado). Rode da raiz, como acima.

---

### Task 9: Projeto web na Vercel + deploy (ops)

- [ ] **Step 1:** Importar o repositório na Vercel, criando o projeto **`usequitto`** (subdomínio `usequitto.vercel.app`). (Se o nome estiver tomado, escolha outro e **volte na Task 1** — `usequitto` aparece em `BETTER_AUTH_URL`/`WEB_ORIGIN`/CORS/redirect Google.)
- [ ] **Step 2: Configurar como monorepo:**
  - **Root Directory:** `apps/web` (é onde está o `vercel.json` com os rewrites).
  - **Framework Preset:** Vite.
  - **Build Command:** `bun run build` (= `vite build`); **Output Directory:** `dist`.
  - Install roda na raiz automaticamente (Vercel detecta o `bun.lock` do workspace).
  - **Sem env vars** (o front usa `window.location.origin`).
- [ ] **Step 3:** Deploy (botão Deploy, ou `vercel --prod` após `vercel link` com Root = `apps/web`).
- [ ] **Aceite:** `https://usequitto.vercel.app` carrega a tela de login; no DevTools, uma chamada a `/api/...` retorna do Fly (não 404). 

🔎 **Gotcha:** se o build falhar resolvendo `@quitto/shared`, confirme que o install rodou na raiz do repo (Vercel faz isso ao detectar workspace bun; se não, ative "Include source files outside Root Directory").

---

### Task 10: Smoke test em produção (ops — critério de aceite da release)

Em `https://usequitto.vercel.app`, com o DevTools (console + network) aberto:

- [ ] **1.** Signup com e-mail/senha funciona.
- [ ] **2.** Login com **Google** funciona (callback sem erro; volta logado).
- [ ] **3.** Recarregar a página **mantém a sessão** (cookie first-party via proxy).
- [ ] **4.** Criar um contrato.
- [ ] **5.** Adicionar uma parcela.
- [ ] **6.** **Subir um comprovante** — upload PUT no R2 sem erro de CORS no console.
- [ ] **7.** **Baixar** o comprovante (abre via URL pré-assinada).
- [ ] **8.** `curl https://usequitto-api.fly.dev/api/ping` → 200.

- [ ] **Aceite final:** 1–8 verdes → **v0.1.0 está em produção**. Se algum falhar, cole o erro (console/network/`fly logs`) que o Claude debuga.

---

### Task 11: Fechamento

- [ ] **Step 1:** Registrar no `docs/superpowers/ROADMAP.md` que o deploy de produção v0.1.0 foi publicado (linha de status).
- [ ] **Step 2:** Próximos passos abertos (não desta fase): **trilha CD** (`2026-06-10-cd-deploy-guia-estudo.md`), **cron de lembretes** (`2026-06-13-cron-fly-lembretes.md`), e o backlog de melhorias → próxima release na `develop`.

---

## Self-review

- **Cobertura do spec:** topologia/proxy (Arch + Task 1 vercel.json); mapa de variáveis (Task 8 secrets + Task 4 migrate); mudanças de repo fly.toml/vercel.json/storage.ts (Task 1); R2 + CORS (Task 5); Google redirect/BETTER_AUTH_URL (Task 6 + Task 8); ordem migrations-antes-da-API (Task 4 antes da 8); GitHub remote (Task 2); deploy Fly (Task 8) e Vercel (Task 9); smoke test 1–8 idêntico ao aceite do spec (Task 10); fora de escopo/cron/CD (Task 11). ✔
- **Placeholders:** os `<...>` são **valores secretos que só o usuário possui** (DATABASE_URL, tokens, client secret) — são entradas do runbook, não placeholders de design; todo comando e config está completo. ✔
- **Consistência:** nome `usequitto-api` igual em fly.toml/vercel.json/secrets/deploy; `usequitto.vercel.app` igual em BETTER_AUTH_URL/WEB_ORIGIN/CORS/redirect Google; bucket `quitto-proofs` igual em R2/secret. Pontos de "se o nome estiver tomado, volte na Task 1" sinalizados (Fly Task 8, Vercel Task 9). ✔
