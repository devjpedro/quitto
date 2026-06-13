# Fase 5b — Notificações (UI)

**Data:** 2026-06-13
**Branch base:** `develop`
**Depende de:** 5a (endpoints `/api/notifications*` já no ar)
**Spec mestre:** `2026-06-09-quitto-design.md` · **Spec 5a:** `2026-06-13-fase-5-notificacoes-design.md`

Consome os endpoints da 5a: `GET /api/notifications`, `GET /api/notifications/unread-count`,
`POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.

## Decisão de layout

O app **não tem topbar** — o shell é sidebar (desktop) + bottom-nav (mobile), e cada página
traz seu próprio cabeçalho. A spec mestre falava em "sininho na topbar" como UX, não como
restrição de layout. Para evitar um refactor de shell arriscado (header global conflitando com
os cabeçalhos por página), o sininho mora na **sidebar** e ganhamos o mobile de graça via
**bottom-nav**:

- **Sininho (desktop):** botão com ícone `Bell` no topo da sidebar, abre um `Popover` com as
  notificações recentes. Badge de não-lidas.
- **Item de nav "Notificações":** entra na lista da sidebar e na bottom-nav (3º item:
  Dashboard · Contratos · Notificações), com badge de não-lidas, levando à rota cheia.
- **Rota `/notifications`:** lista completa + "marcar todas como lidas" + empty state. É o
  destino do toque no mobile (onde não há popover).

## Componentes e arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| web/hooks | `use-notifications.ts` | `notificationsQueryOptions`, `unreadCountQueryOptions` (polling 60s), `useMarkReadMutation`, `useMarkAllReadMutation` |
| web/lib | `query-keys.ts` (modificar) | `notifications`, `notificationsUnread` |
| web/lib | `labels.ts` (modificar) | `NOTIFICATION_TYPE_LABEL` (mensagem pt-BR) + `NOTIFICATION_TYPE_ICON` |
| web/lib | `format.ts` (modificar) | `formatRelativeTimeBR(iso)` ("há 2 dias") |
| web/components | `notification-bell.tsx` | sininho + popover (desktop) |
| web/components | `notification-list.tsx` | lista reutilizável de itens (popover e página) |
| web/routes | `notifications.tsx` | página `/notifications` |
| web/components | `app-sidebar.tsx` (modificar) | sininho + item "Notificações" com badge (sidebar + bottom-nav) |
| web/routes | `contract-detail.tsx` (modificar) | abre o drawer a partir de `?installment=<id>` |
| web | `router.tsx` (modificar) | rota `/notifications`; `validateSearch` em `/contracts/$id` |

## Comportamento

- **Polling:** `unreadCountQueryOptions` com `refetchInterval: 60_000` + refetch on focus. A
  lista (`notificationsQueryOptions`) revalida ao abrir o popover / focar a janela.
- **Marcar lida:** clicar num item → `useMarkReadMutation` + navega ao deep-link. A página e o
  popover têm "marcar todas como lidas" (`useMarkAllReadMutation`). Invalidam `notifications` e
  `notificationsUnread` (sem invalidação global).
- **Deep-link → drawer:** cada notificação tem `contractId` + `installmentId`. O item linka
  para `/contracts/$contractId` com search `{ installment: installmentId }`. A rota de detalhe
  valida o search e inicializa o `openId` (reusa o `useState` existente) → abre direto o drawer
  da parcela.
- **Mensagem por tipo:** `NOTIFICATION_TYPE_LABEL` (de `NOTIFICATION_TYPE`, sem literais):
  `proof_submitted` → "Novo comprovante para confirmar"; `payment_confirmed` → "Pagamento
  confirmado"; `payment_disputed` → "Pagamento contestado" (anexa o `reason` do metadata quando
  houver); `installment_paid` → "Parcela marcada como paga"; `installment_due_soon` → "Parcela
  vencendo em breve"; `installment_overdue` → "Parcela vencida".
- **Tempo relativo:** `formatRelativeTimeBR` via `Intl.RelativeTimeFormat("pt-BR")`.

## Acessibilidade / design

- Sininho é `<button>` com `aria-label` ("Notificações, N não lidas") e o badge com
  `aria-hidden` (o texto do label já comunica). Popover acessível (Radix). Itens da lista são
  links navegáveis por teclado; foco visível.
- Identidade B2 via `frontend-design` (sem cara genérica de IA). Badge usa o tom de destaque já
  do sistema.

## Testes (Vitest + testing-library)

- **hook** (`use-notifications`): query devolve a lista; `markRead`/`markAllRead` invalidam as
  chaves certas (mock do treaty no padrão de `use-contracts.test.tsx`).
- **bell:** mostra o badge com a contagem; abre o popover; clicar num item chama `markRead` e
  navega.
- **página `/notifications`:** lista, empty state, "marcar todas como lidas".
- **deep-link:** `/contracts/$id?installment=<id>` abre o drawer da parcela.
- **sidebar:** item "Notificações" presente (estende `app-sidebar.test.tsx`).

## Fora de escopo

WebSocket/tempo real verdadeiro, agrupamento por contrato, preferências de notificação,
push/e-mail (backlog).
