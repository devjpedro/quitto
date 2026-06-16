# Preparar Produção — Primeiro Deploy Manual (v0.1.0)

**Data:** 2026-06-16
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§ deploy/infra)
**Release:** corta na `main` / tag `v0.1.0` (já criadas).

Objetivo: colocar o MVP **uma vez no ar, na mão**, validando o caminho crítico em produção.
A automação (CD) já tem guia próprio (`2026-06-10-cd-deploy-guia-estudo.md`) e fica pra depois —
você só automatiza com confiança um caminho já percorrido a pé.

## Decisões (travadas no brainstorm)

- **Alvo:** só produção, **domínios padrão** (sem domínio próprio, sem staging).
- **Nomes:** web `usequitto` → `https://usequitto.vercel.app`; API `usequitto-api` →
  `https://usequitto-api.fly.dev`.
- **Auth:** e-mail/senha (sem verificação de e-mail → **sem provedor de e-mail**) **+ Google**
  habilitado em prod.
- **Storage:** **Cloudflare R2** (bucket privado; upload/download via URL pré-assinada).
- **Lembretes (cron):** **adiados** — a app sobe completa; só os lembretes por data não disparam
  até criar a máquina agendada (guia `2026-06-13-cron-fly-lembretes.md`).

## Arquitetura / topologia

Navegador → `https://usequitto.vercel.app` (Vercel, SPA). Chamadas a `/api/*` batem no **mesmo
domínio** e o `vercel.json` faz **rewrite** pra `https://usequitto-api.fly.dev` (Fly, API Elysia,
porta 3000) → Neon (Postgres) + R2 (storage S3-compatível).

**Por que proxy same-origin (e não o front chamando o Fly direto):** o front usa
`window.location.origin` como base tanto do Eden (`apps/web/src/lib/api.ts`) quanto do Better Auth
(`apps/web/src/lib/auth-client.ts`). Chamar o Fly cross-origin tornaria o cookie de sessão
*third-party* (bloqueado por Safari/ITP). O rewrite do `vercel.json` mantém o cookie **first-party**
no domínio da Vercel. Essa escolha já está embutida no código — mantida.

Consequência importante: **o web não precisa de nenhuma env var de API em runtime**
(`VITE_API_URL` é só de dev). Toda a configuração sensível vive na **API (Fly)**.

## Mapa de variáveis

### Fly (API) — secrets (`fly secrets set ...`)

| Var | Valor | Observação |
|---|---|---|
| `DATABASE_URL` | connection string **pooled** do Neon prod | usar o endpoint *-pooler* do Neon |
| `BETTER_AUTH_SECRET` | aleatório ≥32 chars | gerar com `openssl rand -base64 48` |
| `BETTER_AUTH_URL` | `https://usequitto.vercel.app` | origem **pública**; cookie + redirect do Google se baseiam nela (`baseURL` do Better Auth) |
| `WEB_ORIGIN` | `https://usequitto.vercel.app` | entra em `trustedOrigins` (CSRF) |
| `GOOGLE_CLIENT_ID` | client id OAuth de prod | |
| `GOOGLE_CLIENT_SECRET` | client secret OAuth de prod | |
| `S3_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` | endpoint S3 do R2 (account-specific) |
| `S3_REGION` | `auto` | R2 ignora, mas o AWS SDK exige um valor |
| `S3_BUCKET` | `quitto-proofs` | nome do bucket criado no R2 |
| `S3_ACCESS_KEY_ID` | access key do token R2 | |
| `S3_SECRET_ACCESS_KEY` | secret key do token R2 | |

### Vercel (web)

Nenhuma env var de runtime. Build do monorepo (ver §"Vercel").

## Mudanças no repositório (PR pequeno na `develop`, merge antes de subir)

1. **`apps/api/fly.toml`** — `app = "quitto-api"` → `app = "usequitto-api"`.
2. **`apps/web/vercel.json`** — destino do rewrite → `https://usequitto-api.fly.dev/api/:path*`.
3. **`apps/api/src/lib/storage.ts`** — confirmar que `forcePathStyle` não quebra o R2. R2 aceita
   path-style; se hoje está `forcePathStyle: true` fixo (pensado pro MinIO), validar que funciona
   com o endpoint do R2 ou condicionar ao endpoint. (Verificação, não necessariamente mudança.)

Esses três são edições de código/config versionadas → vão num branch `chore/prep-prod-config`,
merge na `develop` e fast-forward na `main` antes do deploy.

## Storage R2

- Criar bucket privado `quitto-proofs` na conta Cloudflare.
- Criar **API Token R2** (escopo de objeto: leitura+escrita no bucket) → vira
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`.
- Pegar o **endpoint S3** da conta (`https://<account_id>.r2.cloudflarestorage.com`).
- **CORS do bucket** — liberar `PUT` e `GET` (e `HEAD`) a partir de `https://usequitto.vercel.app`.
  Sem isso, o upload do comprovante falha **silenciosamente** no navegador (preflight bloqueado).

## Auth / Google

- No **Google Cloud Console** (mesmo projeto OAuth do dev), adicionar o **Authorized redirect URI**
  de prod: `https://usequitto.vercel.app/api/auth/callback/google`.
- `BETTER_AUTH_URL = https://usequitto.vercel.app` faz o Better Auth gerar esse redirect e setar o
  cookie no domínio público. O callback chega pela Vercel e é proxied pro Fly.

## Ordem do deploy (vira o runbook no plano)

0. **GitHub:** criar repositório remoto; `git remote add origin ...`; push de `develop`, `main` e
   da tag `v0.1.0`.
1. **Config PR:** aplicar as 3 mudanças do repositório; merge na `develop`; ff na `main`.
2. **Neon:** criar projeto/branch de produção; copiar a `DATABASE_URL` pooled.
3. **Migrations:** rodar `bun run db:migrate` (em `apps/api`) com `DATABASE_URL` apontando pro Neon
   prod — aplica as 9 migrations antes de qualquer tráfego.
4. **R2:** bucket + token + endpoint + CORS (acima).
5. **Google:** adicionar o redirect URI de prod.
6. **Secret:** gerar `BETTER_AUTH_SECRET`.
7. **Fly:** `fly launch`/`fly apps create usequitto-api` (região `gru`); `fly secrets set` com todo
   o mapa de variáveis; `fly deploy` (usa o `Dockerfile`, contexto = raiz do monorepo).
8. **Vercel:** importar o projeto `usequitto`; configurar build de monorepo (root do repo;
   build = `bun run build --filter=@quitto/web` ou equivalente Turbo; output = `apps/web/dist`;
   install = `bun install`); deploy.
9. **Smoke test** (critério de aceite abaixo).

## Critério de aceite (smoke test em produção)

No ar, em `https://usequitto.vercel.app`:
1. Signup com e-mail/senha funciona.
2. Login com **Google** funciona (callback sem erro).
3. Sessão **persiste ao recarregar** a página (cookie first-party via proxy).
4. Criar um contrato.
5. Adicionar uma parcela.
6. **Subir um comprovante** (upload PUT no R2 via CORS) — sem erro no console.
7. **Baixar** o comprovante (URL pré-assinada GET).
8. `GET https://usequitto-api.fly.dev/api/ping` responde (healthcheck do Fly verde).

Se 1–8 passam, o MVP está em produção e a release `v0.1.0` está publicada.

## Fora de escopo

Cron de lembretes (adiado; guia pronto); domínio próprio; ambiente de staging; **CD automatizado**
(guia de estudo já existe — sua trilha); e-mail transacional (Resend, adiado). Estes entram em
releases/fases seguintes.

## Riscos / gotchas

- **CORS do R2 esquecido** → upload falha calado. Verificar no smoke (item 6) com o console aberto.
- **`BETTER_AUTH_URL` apontando pro Fly em vez da Vercel** → cookie cai no domínio errado e a sessão
  não persiste. Tem que ser a origem pública (`usequitto.vercel.app`).
- **Auto-deploy nativo da Vercel** ligado vai conviver com deploys manuais agora; quando o CD entrar,
  desligar (já anotado no guia de CD). Por ora, tudo bem.
- **Build context do Docker** = raiz do monorepo (precisa de `bun.lock` + `packages/shared`).
- **Migration antes do deploy:** subir a API antes de migrar o Neon = 500 em tudo. Ordem importa.
