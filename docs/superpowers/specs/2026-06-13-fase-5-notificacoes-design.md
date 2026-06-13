# Fase 5 — Notificações + lembretes

**Data:** 2026-06-13
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§domínio `Notification`, §fluxo de pagamento, §job agendado, §app shell)

Fatiada em **5a (API + cron)** e **5b (UI)**, no mesmo padrão das fases anteriores. Cada
metade é testável por si só.

## Contexto

A spec mestre já desenhou o essencial: `Notification(userId destinatário, tipo, referência
contrato/parcela, readAt)`, criação de notificação no fluxo de pagamento, e um cron diário no
Fly que varre parcelas vencendo/vencidas e gera lembretes **só para participantes com conta
vinculada**. Não existe nada disso ainda — terreno limpo.

A Fase 4c já separou **gestão** (`isOwner`) de **capacidade** (`isPayer`/`isApprover`,
derivados da vaga real em `getCapabilities`). As notificações reaproveitam essa mesma lógica
para resolver destinatários — não há regra de papel nova.

## Decisões de design

- **Disparo único do lembrete de atraso.** Cada lembrete (`due_soon`, `overdue`) é criado uma
  vez por parcela, via `dedupeKey` único + `onConflictDoNothing`. Sem re-cutucada diária. Algo
  vencido há 30 dias avisa uma vez; re-aviso periódico fica como backlog.
- **Janela global fixa.** `REMINDER_WINDOW_DAYS = 3` (constante única em `@quitto/shared`).
  Configurável por contrato é backlog (YAGNI — sem coluna nova agora).
- **Sweep é função pura.** `computeReminders(installments, todayISO)` retorna a lista de
  notificações a criar. A Fly scheduled Machine é só o invólucro que carrega os dados, chama a
  função pura e persiste. Gatilho trocável depois (ex.: endpoint + cron externo) sem tocar no
  domínio.
- **Backend é a fonte da verdade dos destinatários.** Quem recebe cada notificação é decidido
  no servidor a partir das vagas/contraparte vinculada. Nunca notifica o próprio ator; pula
  vagas sem `linkedUserId`.
- **Tempo real por polling.** A UI faz `refetchInterval` (60s) no contador de não-lidas +
  `refetchOnWindowFocus`. Sem websocket (grátis, SPA simples).

## Domínio (`@quitto/shared`)

- `NOTIFICATION_TYPE` (objeto `as const` + tipo derivado + array `*_TYPES`):
  `proof_submitted`, `payment_confirmed`, `payment_disputed`, `installment_paid`,
  `installment_due_soon`, `installment_overdue`.
- `REMINDER_WINDOW_DAYS = 3`.
- Zod: `markReadParamsSchema` (id), schemas de resposta conforme necessário.
- Labels/mensagens pt-BR e ícone por tipo ficam em `apps/web/src/lib/labels.ts` (UI), não no
  shared — o shared carrega só os identificadores.

## Schema (`notification`)

```
id            uuid pk
userId        text  → user(id) on delete cascade        (destinatário)
type          text  (um dos NOTIFICATION_TYPE)
contractId    uuid  → contract(id) on delete cascade
installmentId uuid? → installment(id) on delete cascade
metadata      jsonb?
dedupeKey     text? unique                              (lembretes; null nos eventos)
readAt        timestamp?
createdAt     timestamp default now
```

Índices: `(userId, createdAt)` para a lista; `(userId) where readAt is null` (ou contagem
simples) para o contador. `dedupeKey` único garante a idempotência do sweep.

## 5a — API + cron

### Gatilhos de evento

Acoplados às transações existentes em `payments.ts`, ao lado de cada `recordEvent`:

| Evento (status) | Destinatário | Tipo da notificação |
|---|---|---|
| comprovante enviado (`requiresConfirmation`) | aprovador(es) vinculado(s) | `proof_submitted` |
| comprovante enviado (sem confirmação) → paga | contraparte vinculada | `installment_paid` |
| pagamento confirmado | pagador vinculado | `payment_confirmed` |
| pagamento contestado | pagador vinculado | `payment_disputed` |

Helper `lib/notifications.ts` (espelha `recordEvent`): `createNotifications(exec, inputs[])`
insere em lote dentro da tx. `recipientsFor(contractId, target, actorUserId)` resolve os
`linkedUserId` do alvo (`approver` | `payer` | `counterparty`) reusando a mesma derivação de
`getCapabilities`, **excluindo o ator** e vagas sem conta vinculada.

### Sweep de lembretes (puro)

`lib/reminders.ts`: `computeReminders(installments, todayISO)` recebe parcelas abertas
(status ≠ `paid`) de contratos `active` com o `linkedUserId` do pagador já resolvido, e retorna
`{ userId, contractId, installmentId, type, dedupeKey }[]`:
- vencimento dentro de `[hoje, hoje + REMINDER_WINDOW_DAYS]` → `installment_due_soon`,
  `dedupeKey = reminder:due_soon:<installmentId>`.
- vencimento `< hoje` → `installment_overdue`, `dedupeKey = reminder:overdue:<installmentId>`.
- pagador sem `linkedUserId` → ignora (não há quem notificar).

### Cron entrypoint

`apps/api/src/cron/reminders.ts`: carrega os dados, chama `computeReminders`, persiste com
`createNotifications` (+ `onConflictDoNothing` no `dedupeKey`), loga o resumo e sai. Script
`bun run cron:reminders`. Configuração da Fly scheduled Machine (`--schedule daily`)
documentada no plano; não precisa de secret novo.

### Endpoints (escopados ao usuário da sessão)

- `GET /api/notifications` — recentes do usuário (limite + `readAt`), ordem desc.
- `GET /api/notifications/unread-count` — `{ count }`.
- `POST /api/notifications/:id/read` — marca uma (só a própria; 404 se não for dele).
- `POST /api/notifications/read-all` — marca todas as do usuário.

RBAC trivial: `where userId = session.user.id`. Não vaza notificação de terceiro.

## 5b — UI

- `components/notification-bell.tsx`: sininho na topbar, badge com contador de não-lidas,
  popover com a lista (deep-link para o contrato/parcela; marcar lida ao abrir/clicar).
- `routes/notifications.tsx`: lista completa + "marcar todas como lidas". Item "Notificações"
  na sidebar/bottom-nav.
- `hooks/use-notifications.ts`: `notificationsQueryOptions`, `unreadCountQueryOptions`
  (`refetchInterval` 60s), mutations `markRead`/`markAllRead` com invalidação.
- Mensagens/ícones por tipo centralizados em `lib/labels.ts`. Identidade B2 via `frontend-design`.

## Camadas (clean-arch)

| Camada | Arquivos |
|---|---|
| `@quitto/shared` | `NOTIFICATION_TYPE`, `REMINDER_WINDOW_DAYS`, zod |
| api | `db/schema.ts` (`notification`), `lib/notifications.ts` (tx helper + `recipientsFor`), `lib/reminders.ts` (puro), `modules/notifications.ts`, `cron/reminders.ts` |
| web | `hooks/use-notifications.ts`, `components/notification-bell.tsx`, `routes/notifications.tsx`, `lib/labels.ts` |

Sem literais soltos — tipos e janela vêm das constantes.

## Testes

- **Unit (puro):** `computeReminders` — janela, atraso, sem `linkedUserId`, dedupeKey correto.
- **Unit:** `recipientsFor` — alvo certo, exclui o ator, pula não-vinculado.
- **Integração:** gatilhos disparam a notificação certa nas transações de pagamento; endpoints
  só devolvem/alteram as do próprio usuário (404 cross-user); `read-all` zera o contador.
- **Cron:** rodar o entrypoint duas vezes não duplica (idempotência via `dedupeKey`).
- **UI:** contador, lista, marcar lida, polling; deep-link navega.

## Fora de escopo (backlog)

E-mail/push, janela configurável por contrato, re-aviso periódico de atraso, notificação de
convite aceito, preferências de silenciar por contrato.
