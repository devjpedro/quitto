---
status: accepted
date: 2026-07-14
supersedes: "arquitetura.md §9c (SPA, não SSR)"
---

# Migrar o front para TanStack Start (SSR)

O front migra de SPA (Vite + TanStack Router) para **TanStack Start** (SSR/SSG sobre o mesmo
Router + Query + Vite), porque a superfície pública (landing, login) precisa de renderização
instantânea e indexável — não porque o SPA fosse errado.

## Contexto: o diagnóstico real da "tela branca"

A `arquitetura.md §9c` atribuía a "tela branca" a **cold start** do Fly. Isso está **incorreto**.
A causa raiz é que **não existe entrada pública**: a rota `/` é o dashboard, debaixo do
`protectedRoute`. Um visitante anônimo cai numa rota autenticada → `beforeLoad → requireSession →
GET /api/me` → o router mostra o `AppPending` (skeleton **do dashboard**) até o `/api/me` responder
401 e redirecionar pro login. O estranho vê um esqueleto de dados que não existem. SSR **não**
conserta cold start (SSR de dados autenticados até piora — o servidor bloqueia no boot da API fria);
quem conserta a "tela branca" do anônimo é ter uma **landing pública** (ver ADR-0002).

## Considered options

- **TanStack Start** (escolhido): evolução do stack atual; Eden Treaty segue idiomático; menor migração.
- **Next.js (App Router)**: padrão de mercado e melhor SEO, mas maior reescrita (abandona TanStack
  Router, RSC) e Eden Treaty exige fiação manual de cookie no server.
- **React Router v7 (ex-Remix)**: sólido, mas sem vantagem decisiva (nem é o stack atual nem o default Vercel).

## Consequences

- **Backend Elysia no Fly permanece** intacto — Eden Treaty (tipos ponta-a-ponta) preservado.
- **Render split**: landing/login = SSG/SSR **sem chamada de API** (instantâneo); app autenticado =
  casca SSR + **dados no cliente** (TanStack Query), pra nunca travar no boot frio do Fly.
- **Check de sessão = híbrido** (refinamento): o SSR tenta `/api/me` com **timeout curto (~1,5s)**
  encaminhando o cookie — quente resolve no server (usuário não vê nada, resultado desidratado pro
  cliente); frio cai no timeout e o servidor manda a **casca + loader de marca**, cliente assume com
  retry. Só o check leve de sessão ganha essa corrida no server; o dado pesado do app segue no cliente.
  Detalhe no spec [2026-07-15-ssr-spine-design.md](../superpowers/specs/2026-07-15-ssr-spine-design.md) §5.
- As "gambiarras" de cold start (warm-up ping, skeleton genérico no anônimo) deixam de ser necessárias
  na entrada pública; o skeleton segue válido só dentro do app logado.
- Elysia continua **pinado** (compatibilidade do Eden) — a migração não altera isso.
