<div align="center">

# Quitto

**Gestão de contratos parcelados — cada parcela no seu lugar.**

Acompanhe compras parceladas, aluguéis e acordos entre partes (ou solo): contratos, parcelas,
comprovantes e quitação, com aprovação/contestação, notificações e dashboard.

[![CI](https://github.com/devjpedro/quitto/actions/workflows/ci.yml/badge.svg)](https://github.com/devjpedro/quitto/actions/workflows/ci.yml)
![Bun](https://img.shields.io/badge/Bun-1.2-black?logo=bun)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![WCAG](https://img.shields.io/badge/a11y-WCAG%202.2%20AA-0f766e)

🔗 **[usequitto.vercel.app](https://usequitto.vercel.app)**

</div>

---

## Funcionalidades

- **Contratos** parcelados (parcelas iguais ou customizadas), com situação por parcela.
- **Participantes & convites** com papéis dinâmicos (pagador / aprovador) e RBAC por contrato.
- **Comprovantes**: upload direto (URL pré-assinada) → fluxo de **aprovação / contestação** → quitação.
- **Notificações** in-app (eventos de pagamento) + **lembretes** de parcelas a vencer/vencidas.
- **Dashboard**: a pagar/receber, atrasadas, contratos ativos, próximas parcelas com deep-link.
- **Documentos**: recibo de quitação e extrato em **PDF**, export **CSV**.
- **LGPD**: exportar os próprios dados e excluir a conta (com cascata e purga de arquivos).
- **Acessibilidade** WCAG 2.2 AA e **performance** (code-splitting, orçamento Lighthouse).

## Arquitetura

Monorepo (**Bun workspaces + Turborepo**). O front é same-origin: chama `/api/*` no próprio domínio,
e um **reverse-proxy** (rewrite na Vercel) encaminha pro backend no Fly — mantendo o **cookie de
sessão first-party**.

```
Navegador ──▶ usequitto.vercel.app (React SPA · Vercel)
                  │  /api/*  (rewrite)
                  ▼
            usequitto-api.fly.dev (Elysia · Fly.io)
                  ├──▶ Neon (PostgreSQL)
                  └──▶ Cloudflare R2 (comprovantes · presigned)
```

| Camada | Tecnologias |
|---|---|
| **API** | Bun · [Elysia](https://elysiajs.com) · Drizzle ORM · PostgreSQL · [Better Auth](https://better-auth.com) (Google + e-mail/senha) |
| **Web** | React 19 · Vite · TanStack Router & Query · Tailwind v4 · shadcn/Radix |
| **Tipos** | Eden Treaty (cliente tipado ponta a ponta, sem geração de código) |
| **Storage** | Cloudflare R2 (prod) · MinIO (dev/CI) — S3-compatível, upload pré-assinado |
| **Infra** | Vercel (web) · Fly.io (API) · Neon (DB) · GitHub Actions (CI/CD) |
| **Qualidade** | TDD · Biome/Ultracite · Lefthook · `bun test` · Vitest · Playwright + axe |

> Valores monetários são **inteiros em centavos**; datas em ISO com máscara pt-BR.

## Estrutura

```
apps/
  api/        # backend Elysia (rotas, auth, drizzle, storage)
  web/        # SPA React (rotas, hooks, componentes)
packages/
  shared/     # tipos e contratos compartilhados (enums, helpers puros)
e2e/          # suíte Playwright (+ axe) dos fluxos críticos
```

## Rodando localmente

**Pré-requisitos:** [Bun](https://bun.sh) ≥ 1.2 e Docker (para Postgres + MinIO).

```bash
git clone git@github.com:devjpedro/quitto.git
cd quitto
bun install

# sobe Postgres + MinIO (bucket criado automaticamente)
docker compose up -d

# variáveis de ambiente (ajuste se quiser Google OAuth local)
cp .env.example .env

# aplica as migrations
bun run --filter @quitto/api db:migrate

# sobe API (:3000) + web (:3001)
bun run dev
```

Abra **http://localhost:3001**. O Google é opcional em dev (sem `GOOGLE_*`, sobe só com e-mail/senha).

## Variáveis de ambiente

Veja **[`.env.example`](.env.example)**. Resumo:

| Var | Para quê |
|---|---|
| `DATABASE_URL` | conexão Postgres |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | sessão/auth |
| `WEB_ORIGIN` | origem confiável (CORS/CSRF) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | login social (opcional em dev) |
| `S3_ENDPOINT` / `_REGION` / `_BUCKET` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | storage (R2/MinIO) |

## Testes

```bash
bun run test                              # unitários/integração (API: bun test · web: Vitest)
bun run lint && bun run typecheck         # Biome + tsc
cd e2e && bun run e2e                     # E2E Playwright (+ axe a11y) — precisa de docker compose up
bun run --filter @quitto/web lh           # Lighthouse local no /login
```

## CI/CD

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

```
push/PR ──▶ verify (lint·typecheck·test·build) + e2e (Playwright·axe)      ← gate
push main ──────▶ migrate (Neon) ──▶ deploy-api (Fly) ∥ deploy-web (Vercel) ──▶ smoke
```

Nada vai pra produção sem o gate passar. O deploy de produção é **orquestrado pelo pipeline**: o
`main` migra o banco e publica API + web em paralelo, depois valida com smoke test.

## Licença

Proprietário — © 2026 João Pedro Souza Silva. Todos os direitos reservados. Veja [`LICENSE`](LICENSE).
