# Fase 7d — Performance / Lighthouse 100

**Data:** 2026-06-14
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§6 — Lighthouse 100 em Performance/Best Practices/SEO/Accessibility)

Última fatia do MVP (Fase 7). Otimização de carregamento + portão de orçamento Lighthouse.
Web-only.

## Diagnóstico (da auditoria)

- **#1 lever — sem code-splitting:** as 8 rotas são importadas **estaticamente** em `router.tsx`
  → bundle único de ~**716 KB**; quem abre só `/login` baixa contrato/dashboard/wizard/etc.
- **Sem `manualChunks`** (vendor não separado → cache ruim entre deploys).
- **Fontes** sem `font-display: swap`; Space Grotesk é **display-only** (títulos).
- **`index.html`** sem `meta description` (SEO), sem `theme-color`.
- **Sem tooling** de medição (nenhum lhci/visualizer).
- Bons: zero imagens (lucide tree-shaken), Tailwind v4 JIT, named imports tree-shakeable.

## Decisões

- **Code-splitting por rota** com `lazyRouteComponent(() => import(...), "Export")`. **Eager**:
  `rootRoute`, `LoginPage`, `ProtectedLayout` (primeira pintura). **Lazy**: dashboard, contratos
  (lista/novo/detalhe), notificações, settings, aceitar-convite.
- **`manualChunks`** separando vendor (react/react-dom, tanstack) das rotas.
- **`@lhci/cli` com orçamento asserido** rodando contra o `vite preview` do build, alvo `/login`
  (rota pública, não precisa de backend). Local + documentado; o **job na pipeline é do usuário**
  (trilha CD — Claude ensina, não escreve o YAML).
- **Loaders mantidos** (`ensureQueryData`): estão atrás de login (fora do alvo público do
  Lighthouse) e dão UX de "dado pronto ao abrir"; torná-los não-bloqueantes traria flash de
  skeleton sem ganho no número.
- **Evidência de bundle:** `rollup-plugin-visualizer` num script `build:analyze`.

## Mudanças

1. **`router.tsx`:** trocar os imports estáticos das rotas lazy por `lazyRouteComponent`. Os
   `loader`s e `queryOptions` continuam eager (são objetos leves).
2. **`vite.config.ts`:** `build.rollupOptions.output.manualChunks` (vendor react + tanstack);
   `rollup-plugin-visualizer` ativado por env (`ANALYZE=1`) no script `build:analyze`.
3. **Fontes (`index.css`/main):** garantir `font-display: swap` (se o `@fontsource` não setar,
   self-host mínimo com `@font-face { font-display: swap }`); `<link rel="preload">` do woff2 da
   weight 500. Subsets latin-ext/vietnamese já são lazy via `unicode-range` (não baixam p/ pt-BR).
4. **`index.html`:** `<meta name="description" ...>` (pt-BR), `<meta name="theme-color" ...>`
   (teal B2). CSS antes do script (Vite controla; conferir no build).
5. **Medição (`@lhci/cli` + `lighthouserc.json` no `apps/web`):** `collect` sobe
   `vite preview`, audita `/login`; `assert` com orçamento (ver Alvos). Script `lh`.

## Alvos de orçamento (lhci assert)

Na rota pública `/login` (medida no preview do build de produção):
- **Performance ≥ 0.95** (meta 1.0).
- **Accessibility = 1.0** (a 7c já garante a semântica; axe verde).
- **Best Practices ≥ 0.95**.
- **SEO = 1.0** (title por rota + meta description + lang pt-BR).

(Rotas autenticadas: conferência manual de Lighthouse documentada — não entram no gate
automatizado por exigirem sessão.)

## Arquivos

web: `router.tsx`, `vite.config.ts`, `index.html`, `index.css`/`main.tsx` (fontes),
`package.json` (devDeps `@lhci/cli`, `rollup-plugin-visualizer`; scripts `lh`, `build:analyze`),
`lighthouserc.json` (criar). Doc: `docs/superpowers/guides/2026-06-14-lighthouse-ci-job.md`.

## Testes / verificação

- **lhci:** `bun run lh` (build → preview → audita `/login`) passa o orçamento asserido.
- **Suítes existentes** (web Vitest + e2e) seguem verdes — code-splitting não muda comportamento
  (o `a11y.spec`/specs da 7b ainda passam; lazy routes resolvem antes do assert).
- **Bundle:** `bun run build:analyze` mostra a entrada `/login` enxuta + chunks por rota
  (registrar o tamanho do chunk inicial no guia, antes/depois).
- **Manual:** Lighthouse do Chrome numa rota autenticada (dashboard) documentado no guia.

## Fora de escopo

SSR/streaming (decidido manter SPA); PWA/service worker; otimização de imagens (não há);
job de CI de Lighthouse (trilha CD do usuário).
