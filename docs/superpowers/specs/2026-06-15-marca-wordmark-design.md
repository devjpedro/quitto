# Marca / Wordmark — Quitto

**Data:** 2026-06-15
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (identidade B2 — teal `#0f766e` + areia)

Polimento de marca. Substitui o "logo" atual — o glifo unicode `◷` + texto, dependente da
fonte do sistema e sem favicon SVG — por um wordmark desenhado e reutilizável. Web-only.

## Conceito

Logotipo = a palavra `quitto` em Space Grotesk 700, onde **o "o" final é o anel de progresso**:
trilha clara (`#cfe8e2`) + arco teal (`#0f766e`) fechado ~70%, com pontas arredondadas. A marca
carrega a história do produto (cada parcela fecha o anel; ecoa o "% quitado" do app). Sem ícone
avulso — o conceito vive dentro da palavra.

## Decisões

- **Caixa:** o **logotipo é minúsculo** (`quitto`) — é a peça gráfica. Em texto corrido, títulos e
  `document.title` a marca segue **"Quitto"** (capitalizada). `page-title.ts` e copy **não mudam**.
- **Componente apresentacional:** `Logo` não navega nem decide rota — só desenha a marca
  (`role="img"`, `aria-label="Quitto"`). O comportamento de clique é do consumidor (UI fina).
- **Clique → início:** na **sidebar**, o `Logo` é embrulhado num `<Link to="/">` (TanStack Router)
  com `aria-label="Ir para o início"`. No **painel do login** não há "início" além da própria tela,
  então lá o `Logo` fica **não-clicável** (decorativo da marca).
- **Duas variantes** de cor, definidas num único lugar:
  - `brand` — teal sobre fundo claro (sidebar).
  - `inverted` — branco + trilha translúcida, sobre o painel teal do login.
- **Favicon** = só o anel (`LogoMark`), legível a 16px.

## Componentes (`apps/web/src/components/`)

Arquitetura fina, geometria centralizada — **sem números mágicos** espalhados.

- **`LogoMark`** — só o anel (o "o"). Props: `size` (px), `variant: "brand" | "inverted"`.
  Renderiza dois `<circle>` (trilha + arco via `stroke-dasharray`/`rotate`).
- **`Logo`** — `quitt` (texto, `font-display`/Space Grotesk 700) + `<LogoMark>` alinhado à
  baseline, num `inline-flex`. Props: `size`, `variant`. Expõe `role="img"` + `aria-label="Quitto"`
  (o texto interno fica `aria-hidden`, pra leitor de tela anunciar uma coisa só).
- **Geometria/cores centralizadas:** constantes nomeadas para raio, espessura do stroke, dash e
  rotação do arco; mapa de cores por variante (`track`/`arc`). Um lugar só edita o tratamento.

## Aplicação

- **`app-sidebar.tsx`** — troca `◷ Quitto` por `<Link to="/" aria-label="Ir para o início"><Logo
  variant="brand" /></Link>`.
- **`auth-brand-panel.tsx`** — troca `◷ Quitto` por `<Logo variant="inverted" />` (não-clicável;
  conversa com os anéis decorativos já presentes no painel).
- **`public/favicon.svg`** (criar) — `LogoMark` em teal sólido sobre transparente; `index.html`
  aponta pra ele (substitui o favicon atual). `theme-color` já é teal (Fase 7d).

## Fonte

Depende de Space Grotesk 700 — já é o `--font-display`, com `font-display: swap` (Fase 7d). O
fallback `sans-serif` não afeta o anel (SVG). O texto `quitt` herda o mesmo stack do wordmark atual.

## Testes

- **Vitest:** `Logo` e `LogoMark` renderizam com `role="img"` e `aria-label="Quitto"`; a variante
  aplica as cores corretas (`brand` vs `inverted`); o texto interno é `aria-hidden`.
- **Sidebar:** o `Logo` está dentro de um link para `/` com `aria-label="Ir para o início"`.
- **a11y (Fase 7c):** a suíte axe segue verde — a marca passa a ser uma imagem rotulada.

## Arquivos

web: `components/logo.tsx` (criar — `Logo` + `LogoMark` + constantes), `components/app-sidebar.tsx`,
`components/auth-brand-panel.tsx`, `index.html`, `public/favicon.svg` (criar).
Testes: `components/logo.test.tsx` (criar).

## Fora de escopo

Animação do anel (futuro); dark mode; alterar a copy/nome em texto; mudar a fonte da marca.
