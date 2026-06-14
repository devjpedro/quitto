# Fase 6a — Dashboard (visão geral)

**Data:** 2026-06-13
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md`

Primeira fatia da Fase 6 (Dashboard → PDF/export → LGPD). As fatias 6b e 6c ganham spec/plano
próprios quando forem executadas (JIT).

## Objetivo

Substituir o placeholder de `/` por uma visão geral acionável dos contratos do usuário: quanto
ele tem **a pagar** e **a receber**, o que está **atrasado**, e as **próximas parcelas** —
cada uma levando direto à parcela no contrato.

## Decisões

- **Agregação no servidor.** Um endpoint dedicado `GET /api/dashboard` calcula tudo numa
  coleta só (mais eficiente e testável que derivar no front a partir da lista de contratos).
- **Classificação pela vaga do usuário.** Cada parcela em aberto entra em "a pagar" (usuário é
  `buyer`) ou "a receber" (usuário é `seller`). A vaga sai de `participant.role` onde
  `linkedUserId = user.id`; fallback para `contract.ownerRole` em contratos legados sem linha de
  participante (mesma safety net de `getContractRole`).
- **Viewer fica de fora.** Contratos onde o usuário é só `viewer` não entram em totais, atraso
  nem upcoming — o dashboard reflete os compromissos/recebíveis **dele**.
- **Sem lib de chart.** Stat cards + lista bastam; gráfico tem custo de bundle/Lighthouse e fica
  como backlog (eventualmente Fase 7).
- **Plano único** (API + UI numa branch) — feature enxuta (um endpoint + uma página), sem split
  a/b.

## Agregação pura (`apps/api/src/lib/dashboard.ts`)

`computeDashboard(contracts, todayISO)` — entrada por contrato:

```
{ title: string; userSlot: "buyer" | "seller" | "viewer"; status: ContractStatus;
  installments: { id; sequence; amountCents; dueDate; status }[] }
```

Saída (`DashboardSummary`):

```
{
  toPayCents: number;          // soma das parcelas abertas onde userSlot === buyer
  toReceiveCents: number;      // ... onde userSlot === seller
  overdueCount: number;        // parcelas abertas e vencidas (buyer/seller)
  overdueCents: number;
  activeContractsCount: number;
  completedContractsCount: number;
  upcoming: {
    contractId: string; contractTitle: string; sequence: number;
    amountCents: number; dueDate: string;          // YYYY-MM-DD
    direction: "pay" | "receive"; isOverdue: boolean;
  }[];                          // até 5, ordem por dueDate asc (vencidas no topo, pois dueDate menor)
}
```

Regras:
- "Em aberto" = `!isPaidStatus(status)`.
- Atraso = `isOverdue(dueDate, status, todayISO)`.
- `upcoming` considera só parcelas abertas de contratos onde o usuário é buyer/seller; `direction`
  segue a vaga; ordena por `dueDate` ascendente e corta em 5.
- Viewer: contrato ignorado por completo nos números e no upcoming (mas pode contar em
  `activeContractsCount`? **Não** — counts refletem contratos onde o usuário é parte).

## Endpoint `GET /api/dashboard`

1. `requireAuth`.
2. Coleta os contratos do usuário (igual ao list: `participant.linkedUserId` + `ownerId`).
3. Carrega as parcelas desses contratos e as linhas de `participant` do usuário (mapa
   `contractId → role`).
4. Resolve `userSlot` por contrato: `roleByContract.get(id)` ou, se ausente e for dono com
   `ownerRole` buyer/seller, o `ownerRole`; senão `viewer`.
5. Chama `computeDashboard(...)` e devolve o resumo. Response tipado (TypeBox) com os campos
   acima; `direction` como `t.Union([t.Literal("pay"), t.Literal("receive")])`.

## UI (`apps/web/src/routes/dashboard.tsx`)

`frontend-design` (identidade B2):
- **4 stat cards:** A receber (`toReceiveCents`) · A pagar (`toPayCents`) · Atrasadas
  (`overdueCount` + `overdueCents`) · Contratos ativos (`activeContractsCount`). Tom de alerta
  no card de atrasadas quando > 0.
- **"Próximas parcelas":** lista do `upcoming`. Cada item: título do contrato, parcela Nº, valor,
  vencimento (DD/MM/AAAA), rótulo a pagar/a receber, badge "vencida" quando `isOverdue`. Clicar
  → navega a `/contracts/$id` com `search { installment: <id> }` (reusa o deep-link da 5b, abre
  o drawer).
- **Empty state** (sem contratos): mensagem + CTA "Criar contrato" → `/contracts/new`.
- **Loading:** skeletons (padrão das outras telas).

`hooks/use-dashboard.ts`: `dashboardQueryOptions` (`queryKey: ["dashboard"]`), `useDashboardQuery`.
A rota `/` recebe `loader` com `ensureQueryData(dashboardQueryOptions)`.

Rótulos de direção em `lib/labels.ts`: `DIRECTION_LABEL = { pay: "a pagar", receive: "a receber" }`
(sem literais soltos). `lib/query-keys.ts`: `dashboard`.

## Acessibilidade / design

- Stat cards com rótulo textual (não só cor); valores `tabular-nums`. Lista navegável por
  teclado; foco visível. Identidade B2, sem cara genérica de IA.

## Testes

- **Unit (`computeDashboard`):** classifica buyer→pay / seller→receive; soma só abertas; conta e
  soma atraso; ordena e corta o upcoming em 5; ignora contratos viewer; counts active/completed.
- **Integração (`GET /api/dashboard`):** só agrega os contratos do usuário (outro usuário não
  vaza); buyer vê "a pagar", seller vê "a receber"; parcela vencida entra em overdue; sessão
  ausente → 401.
- **Web:** hook desembrulha; página renderiza os valores dos cards, a lista de upcoming, o empty
  state; clicar num upcoming navega com o `?installment`.

## Fora de escopo (6b/6c e backlog)

Gráficos, recibo/quitação PDF, export CSV/PDF (6b), exportar dados/excluir conta (6c), filtros
por período, metas.
