# Fase 7c — Acessibilidade (WCAG 2.2 AA)

**Data:** 2026-06-14
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§6 — WCAG 2.2 AA de verdade: teclado, foco, ARIA, contraste)

Fatia de polimento (Fase 7). Auditoria + correções de a11y sobre o app existente, com portão
automatizado durável. Web (correções) + `e2e/` (scan axe).

## Diagnóstico (da auditoria)

Base Radix forte: diálogos, sheet, popover, select, dropdown já trazem foco/ARIA. As lacunas são
**pontuais e de baixo risco** (atributos/semântica), conjunto fechado:

- **Shell:** falta `<main>` landmark, `<title>` por rota e skip-link (`<html lang="pt-BR">` já ok).
- **Formulários:** erros não associados aos campos (`aria-describedby` + `aria-invalid`) em
  `login.tsx`, `contract-new.tsx` (`FieldError`), `settings`/payment; textarea de contestação em
  `payment-actions.tsx` sem `<label>`.
- **Navegação:** sem `aria-current="page"` no link ativo; bottom-nav sem `aria-label`.
- **Botões/itens:** itens da lista de notificações, linhas de "próximas parcelas" do dashboard e o
  toggle de modo do login sem `aria-label`; `PopoverContent` do sininho sem rótulo; `Progress` sem
  `aria-valuenow`/label.
- **Contraste:** majoritariamente AA-ok; revisar teal-como-texto em fundo claro (caso pontual).

## Método

- **Portão automatizado = axe no Playwright** (`@axe-core/playwright`), no pacote `e2e/`
  (reusa o harness da 7b). Um `a11y.spec.ts` faz login/seed via as fixtures existentes e roda
  `AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()` em **cada
  rota/estado**: `/login` (deslogado); logado: `/` (com e sem contratos), `/contracts`,
  `/contracts/new`, `/contracts/$id` (+ drawer da parcela aberto), `/notifications`, `/settings`.
  Falha se houver violações.
- **axe cobre ~30-40% do WCAG** — o resto (foco, rótulos significativos, ordem de tab) é a lista
  de correções manuais abaixo (já enumerada), corrigida item a item.
- **Revisão manual de teclado/foco** documentada por fluxo (tab order; foco ao abrir/fechar drawer
  e diálogos — Radix trata, validamos).
- **Lighthouse Accessibility** fica para a 7d rodar o número final; aqui fazemos a semântica.

## Correções (escopo)

1. **Shell (`routes/protected.tsx`, `index.html`/root):**
   - Envolver o `Outlet` em `<main id="conteudo">`.
   - **Skip-link** "Pular para o conteúdo" (sr-only, visível ao focar) antes da sidebar, apontando
     para `#conteudo`.
   - **`<title>` por rota:** hook `useDocumentTitle(title)` (set `document.title`) chamado em cada
     página, com títulos centralizados (`PAGE_TITLE`) no formato `Quitto · <página>`.
2. **Formulários:** padrão de erro acessível — `aria-invalid` no campo + `aria-describedby`
   apontando para o `<p id="...-error" role="alert">`. Aplicar em `login.tsx`, no `FieldError` do
   `contract-new.tsx` (gera id por campo) e na textarea de contestação (`payment-actions.tsx`,
   com `<Label htmlFor>`).
3. **Navegação (`app-sidebar.tsx`):** `aria-current="page"` no link ativo (via `activeProps` do
   `Link`); `aria-label` no `<nav>` da bottom-nav.
4. **Rótulos:** `aria-label` nos itens de `notification-list.tsx` (mensagem + tempo), nas linhas de
   upcoming do `dashboard.tsx` (contrato + valor + situação), no toggle de modo do `login.tsx`;
   `aria-label` no `PopoverContent` do sininho; `aria-label`/`aria-valuenow` no `Progress`.
5. **Contraste:** ajustar o único par teal-texto/fundo-claro que ficar < 4.5:1 (se o axe acusar).

Fora de escopo: dark mode (AAA/futuro); reescrever componentes que o Radix já cobre.

## Arquivos

web: `routes/protected.tsx`, `components/app-sidebar.tsx`, `routes/login.tsx`,
`routes/contract-new.tsx`, `components/payment-actions.tsx`, `components/notification-list.tsx`,
`components/notification-bell.tsx`, `routes/dashboard.tsx`, `components/ui/progress.tsx`,
`hooks/use-document-title.ts` (criar) + `lib` para `PAGE_TITLE`, e `index.css` (utilitário
sr-only se faltar). e2e: `package.json` (+`@axe-core/playwright`), `specs/a11y.spec.ts` (criar).

## Testes

- **e2e `a11y.spec.ts`:** zero violações axe (tags WCAG A/AA/2.2) em todas as rotas/estados.
- **web (Vitest):** asserts pontuais nas correções testáveis em jsdom — ex.: input com erro tem
  `aria-invalid` e `aria-describedby` ligado ao texto; item de notificação tem `aria-label`;
  `useDocumentTitle` seta `document.title`. (Os existentes seguem verdes.)
- **Manual:** checklist de teclado por fluxo no guia.

## Verificação

`bun run e2e specs/a11y.spec.ts` verde; suíte web verde; typecheck/lint. Lighthouse a11y conferido
na 7d.
