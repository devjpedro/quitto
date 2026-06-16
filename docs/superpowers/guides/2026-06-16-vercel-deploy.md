# Guia — Deploy do web na Vercel (monorepo)

Publicar o front (`apps/web`) na Vercel via **integração com o GitHub** (não CLI). Para monorepo com
workspace bun, a integração Git é o caminho robusto: a Vercel clona o **repo inteiro** e builda com
o Root Directory em `apps/web`, mantendo acesso a `packages/shared`.

## 1. Importar o projeto

1. https://vercel.com → **Add New… → Project**.
2. **Import Git Repository** → autorize o GitHub se pedir → selecione **`devjpedro/quitto`**.

## 2. Configurar (antes de clicar em Deploy)

- **Project Name:** `usequitto` → a URL de produção fica `https://usequitto.vercel.app`.
- **Root Directory:** clique **Edit** e selecione **`apps/web`**. (É onde está o `vercel.json` com o
  rewrite do `/api` pro Fly.)
- **Framework Preset:** Vite (deve ser auto-detectado).
- **Build Command:** `bun run build` (ou deixe o default `vite build`).
- **Output Directory:** `dist` (default do Vite).
- **Install Command:** deixe o default — a Vercel detecta o `bun.lock` e roda `bun install` na raiz
  do workspace.
- **Environment Variables:** **nenhuma** (o front usa `window.location.origin`).

## 3. Deploy

Clique **Deploy** e aguarde o build.

## 4. Conferir a URL de produção (importante)

Depois do deploy, confirme que o domínio de produção é **exatamente** `https://usequitto.vercel.app`.

> ⚠️ Se a Vercel der outro domínio (ex.: `usequitto-xyz.vercel.app` porque `usequitto` já estava
> tomado no `*.vercel.app` global), **me avise**: aí a gente realinha 3 coisas pro novo domínio —
> os secrets `BETTER_AUTH_URL`/`WEB_ORIGIN` no Fly, o **CORS** do bucket R2, e o **redirect URI** do
> Google. Não dá pra deixar divergente, senão a sessão e o upload quebram.

## 5. Gotchas

- **Build falha resolvendo `@quitto/shared`:** confirme que está ligado
  *Settings → Build & Development → "Include source files outside of the Root Directory"* (a Vercel
  costuma ligar sozinho ao detectar monorepo). É isso que dá acesso a `packages/shared`.
- **Auto-deploy:** ao conectar o Git, a Vercel passa a fazer deploy automático a cada push na `main`.
  Por ora tudo bem; quando montarmos o CD (trilha de estudo), a gente decide desligar pra o pipeline
  ser a única porta de deploy.

## 6. Aceite

- `https://usequitto.vercel.app` abre a **tela de login** do Quitto.
- No DevTools → Network, uma chamada a `/api/...` (ex.: `/api/me`) retorna do Fly (status 200/401,
  **não** 404) — prova de que o rewrite do `vercel.json` está ativo.

(O fluxo completo é validado no smoke test — Task 10.)
