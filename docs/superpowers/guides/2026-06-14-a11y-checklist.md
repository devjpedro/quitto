# Fase 7c — Checklist de acessibilidade (teclado) — 2026-06-14

Resultado da verificação manual/automatizada de teclado dos fluxos principais, feita ao
fim da Fase 7c. A navegação foi dirigida com o **Chromium real** (Playwright do pacote
`e2e/`) contra os servidores de dev, inspecionando `document.activeElement` a cada passo —
mais objetivo que inspeção a olho. Onde um item depende só de CSS (anel de foco) ou não foi
dirigido ponta a ponta, está marcado explicitamente.

Legenda: ✅ verificado · 🟡 coberto por Radix + portão axe, não dirigido exaustivamente ·
📝 observação honesta.

## Itens do checklist

| # | Item | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Skip-link aparece no 1º Tab e pula para o conteúdo | ✅ | 1º `Tab` foca o `<a>` "Pular para o conteúdo"; `Enter` move o foco para `<main id="conteudo">` (`activeElement.id === "conteudo"`). |
| 2 | Foco alcança os interativos (não trava no body) | ✅ | Sequência real de `Tab` percorre skip-link → "Criar contrato" → sininho (`aria-label="Notificações"`) → links da sidebar → "Sair"; `stuckOnBody = false`. |
| 3 | Abrir/fechar **drawer da parcela** devolve o foco ao gatilho | ✅ (corrigido) | Era um bug real (foco caía no `<body>` ao fechar — `Sheet` desmontava sincronamente, cortando o `FocusScope` do Radix). Corrigido em `installment-drawer.tsx` (cache da parcela via ref para atravessar a transição de fechamento + captura do gatilho + `onCloseAutoFocus`). Guarda de regressão: `e2e/specs/a11y-keyboard.spec.ts` ("devolve o foco ao gatilho"). |
| 4 | Diálogos de pagamento (confirmar/contestar/marcar paga) devolvem o foco ao gatilho | ✅ (corrigido) | Também era bug real (diálogos Radix controlados **sem** `Trigger` → `onCloseAutoFocus` não tinha alvo, foco ia ao `<body>`). Corrigido em `payment-actions.tsx` (ref por gatilho + `onCloseAutoFocus` restaurando o foco). Guarda: `a11y-keyboard.spec.ts` ("diálogo de pagamento devolve o foco ao gatilho", via "Marcar como paga"). 📝 "Confirmar"/"Contestar" receberam o mesmo padrão; não cobertos por e2e independente (exigem cenário de 2 usuários) — mecanismo idêntico. |
| 5 | Popover do sininho operável e devolve o foco ao gatilho | ✅ | `Enter` abre o popover (foco entra no conteúdo); `Escape` fecha e o foco **retorna ao botão do sininho**. |
| 5b | Demais diálogos controlados devolvem o foco ao gatilho (excluir conta, menu de ações, participantes) | ✅ | Mesmo padrão estendido a `delete-account-dialog`, `contract-actions-menu` e `participants-drawer` (Sheet + confirm). Para os diálogos abertos por `DropdownMenuItem`, o foco volta ao **gatilho do dropdown** via ref estável (determinístico, sem corrida de timing) — extraído no hook `hooks/use-focus-restore.ts`. Guardas e2e: "excluir conta" (`/settings`) e "excluir contrato" (menu de ações). 📝 Sheet de participantes + confirm de remoção aplicados pelo mesmo mecanismo (não cobertos por e2e independente). |
| 6 | Menu de ações do contrato operável | 🟡 | `DropdownMenu` do Radix (teclado/`aria-expanded`/foco geridos pelo Radix); rotas com o menu passam no portão axe. Não dirigido tecla-a-tecla nesta rodada. |
| 7 | Wizard de novo contrato navegável | 🟡 | `/contracts/new` passa no portão axe (sem violações WCAG A/AA); usa controles de formulário padrão (Input/Select/datepicker Radix) com erros associados (`aria-invalid`/`aria-describedby`/`role="alert"` — Task 2). Fluxo completo não dirigido tecla-a-tecla. |
| 8 | Anel de foco visível em todos os interativos | 📝 | Não asserido programaticamente (é concern de CSS). Os componentes `ui/*` usam classes `focus-visible:ring-*`; conferência visual recomendada na 7d (Lighthouse). |

## Portão automatizado (complementa o teclado)

- **axe-core (WCAG 2a/2aa/21aa/22aa)** roda em `e2e/specs/a11y.spec.ts` sobre login,
  dashboard (vazio e com contrato), `/contracts`, `/contracts/new`, detalhe do contrato,
  drawer da parcela aberto, `/notifications` e `/settings` — `expect(violations).toEqual([])`,
  sem `disableRules`. Verde.
- **Regressão de foco de teclado**: `e2e/specs/a11y-keyboard.spec.ts` (2 testes) — drawer e
  diálogo de pagamento devolvem o foco ao gatilho.

## Bugs de a11y encontrados e corrigidos nesta fase

1. Drawer da parcela perdia o foco ao fechar (WCAG 2.4.3) → corrigido (`installment-drawer.tsx`).
2. Diálogos de pagamento perdiam o foco ao fechar (WCAG 2.4.3) → corrigido (`payment-actions.tsx`).
3. Restauração de foco estendida, por consistência, a todos os diálogos controlados restantes
   (`delete-account-dialog`, `contract-actions-menu`, `participants-drawer`); os abertos por
   dropdown usam ref do gatilho via hook `use-focus-restore` (determinístico).
4. Contraste insuficiente em badges (`color-contrast`) → corrigido pontualmente em
   `index.css` (token `--muted-foreground` mais escuro; `--primary-strong` exposto) e
   `ui/badge.tsx`.

## Follow-ups (não bloqueiam a 7c)

- Conferência visual do anel de foco e contraste fino na **7d** (Lighthouse a11y).
- Cobertura e2e de foco para os diálogos "Confirmar"/"Contestar" (precisa de cenário de 2 usuários).
- Se o dark mode for ativado no futuro, re-rodar o portão axe — os tokens de contraste foram
  ajustados só para o tema claro (único ativo hoje).
