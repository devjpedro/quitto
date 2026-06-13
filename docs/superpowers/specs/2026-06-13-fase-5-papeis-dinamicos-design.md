# Fase 5 — Papéis dinâmicos + refino do gerenciamento

**Data:** 2026-06-13
**Branch base:** `develop`

## Contexto e problema

Três incômodos levantados após a Fase 4, dois deles com a **mesma raiz**:

1. **Drawer de participantes feio.** Com a adição do `Select` de papel, cada participante virou uma única linha horizontal apertada: `[ponto] nome [select papel] [Dono] [Convidar] [Remover]`. Controles demais competindo lado a lado.
2. **Badge de papel não-dinâmica.** Na tela de detalhe (`contract-detail.tsx`), a badge mostra `contract.ownerRole` (fixo, o papel que o dono escolheu) em vez do papel do usuário logado. Logado como vendedor, aparece "comprador".
3. **Ações de pagamento confusas.** O dono+comprador vê "Confirmar/Contestar" mesmo havendo um vendedor já aceito que deveria ser o aprovador — anulando o sentido da confirmação.

### Raiz comum (pontos 2 e 3)

Desde a mudança "fixes-pós-4b", o dono passou a ocupar uma vaga real de comprador/vendedor (com flag `isOwner`). Mas `getContractRole` (`apps/api/src/lib/contract-access.ts:25`) ainda **curto-circuita e retorna `"owner"`**, descartando a vaga real. Disso decorre:

- A badge nem usa o papel do usuário (usa `ownerRole`).
- `installment-actions.ts:22-24` trata `"owner"` como **pagador E aprovador** (`isPayer = owner||buyer`, `isApprover = owner||seller`), e os 5 endpoints de `payments.ts` autorizam `owner` em ambos os lados.

O literal `"owner"` é usado hoje para **dois conceitos distintos** que serão separados:
- **Gestão** (gate de editar participantes/parcelas) → flag `isOwner`.
- **Capacidade de pagamento** (pagar/aprovar) → `isPayer`/`isApprover` derivados da vaga.

## Decisões de design

- **Capacidade segue a vaga, com fallback do dono.** O dono só herda os poderes do *outro lado* enquanto a outra vaga **não tiver contraparte vinculada**. Cobre o caso solo (dono acumula os dois lados) sem regra especial.
- **Gatilho = a contraparte ACEITA** (`linkedUserId !== null`). Enquanto a vaga oposta estiver só convidada, o dono mantém o poder do outro lado (não trava o fluxo se o convidado nunca aparecer).
- **Backend é a fonte de verdade.** A API calcula `isPayer`/`isApprover` e os devolve prontos; o front apenas renderiza. Corrigir só a UI deixaria a brecha de autorização viva.
- **Layout do drawer = opção A** (card empilhado com campo "Papel" rotulado + ações em menu ⋯).

## Arquitetura

### 1. Resolução de papel e capacidade (backend)

**`getContractRole(userId, contractId)`** passa a retornar `{ role, isOwner }`:
- `role`: vaga real — `"buyer" | "seller" | "viewer"` (da linha de `participant`; o dono sempre tem vaga buyer/seller, garantido em `contracts.ts:86-91` no create).
- `isOwner`: `contract.ownerId === userId`.
- Sem acesso → lança `NotFoundError` (404), como hoje (não vaza existência).
- **Safety net:** se o dono não tiver linha de participante (inconsistência legada), cai para `contract.ownerRole`.

**Novo `getCapabilities(userId, contractId)`** → `{ role, isOwner, isPayer, isApprover }`. Carrega os participantes do contrato e aplica:
- `isPayer` = `role === "buyer"` **OU** (`isOwner` **e** não existe participante `role==="buyer"` com `linkedUserId !== null`).
- `isApprover` = `role === "seller"` **OU** (`isOwner` **e** não existe participante `role==="seller"` com `linkedUserId !== null`).

Vive em `apps/api/src/lib/contract-access.ts`. Reusa `getContractRole` para a base + uma query de participantes.

**Call sites atualizados** (o literal `"owner"` some):
- `payments.ts` — `loadInstallmentForUser` passa a expor capabilities; os 5 endpoints trocam:
  - presign / proofs / mark-paid: `role !== "owner" && role !== "buyer"` → `!isPayer`.
  - confirm / dispute: `role !== "owner" && role !== "seller"` → `!isApprover`.
- `participants.ts:50` `requireOwner` e `contracts.ts:272` PATCH parcela: `role !== "owner"` → `!isOwner`.
- `contracts.ts:168` GET `/contracts/:id`: devolve `role` (vaga real) + `isOwner` + `isPayer` + `isApprover` (atualizar também o `response` TypeBox).

### 2. Ações de pagamento (web — ponto 3)

`apps/web/src/lib/installment-actions.ts` — `availableActions` deixa de receber `role: string`:

```ts
availableActions(
  caps: { isPayer: boolean; isApprover: boolean },
  requiresConfirmation: boolean,
  status: string,
): InstallmentActions
```
- `canUpload` / `canMarkPaid` → gated por `caps.isPayer`.
- `canConfirm` / `canDispute` → gated por `caps.isApprover`.

`apps/web/src/components/payment-actions.tsx` recebe `capabilities` (de `contract.isPayer/isApprover`) em vez de `contractRole`. Atualizar os call sites que passam `contractRole` ao componente, e os tipos do hook `use-contracts.ts`.

**Resultado:** dono+comprador com vendedor aceito → `isApprover=false` → sem "Confirmar/Contestar". Contrato solo → `isApprover=true` → mantém ambos.

### 3. Badge de papel dinâmica (web — ponto 2)

`apps/web/src/routes/contract-detail.tsx`, header (linha ~82):
- Troca `ROLE_LABEL[contract.ownerRole]` por `ROLE_LABEL[role]`, usando o `role` (vaga real do usuário) agora devolvido pela API.
- Quando `isOwner === true`, renderiza **também** a tag "Dono" (`Badge tone="brand"` + `OWNER_BADGE_LABEL`, de `lib/labels.ts`) ao lado.
- `viewer` → "convidado".

### 4. Redesenho do drawer (web — ponto 1, layout A)

`apps/web/src/components/participants-drawer.tsx` — `ParticipantItem` reestruturado:
- **Linha de identidade:** ponto de status (vinculado/pendente) + nome + tag "Dono" + menu **⋯** à direita.
- **Campo "Papel"** rotulado abaixo, `Select` de largura total (não mais espremido na linha do nome).
- **Ações** (`Convidar` se não-vinculado; `Remover participante` se não-dono) movidas para dentro do menu ⋯. O `Dialog` de confirmação de remoção é mantido.
- O painel de convite (`InvitePanel`) continua expandindo no card ao acionar "Convidar".

**Novo componente** `apps/web/src/components/ui/dropdown-menu.tsx`: wrapper sobre `DropdownMenu` do pacote `radix-ui` (já instalado, `^1.5.0`), seguindo o padrão de `popover.tsx`/`select.tsx`. Sem dependência nova.

`availableRolesFor`, as mutações (`use-participant-mutations.ts`) e o `InvitePanel` **não mudam** — é reorganização de layout + o dropdown.

## Testes

- **`getCapabilities`** (unit, backend): solo; dono+comprador com vendedor vinculado; dono+comprador com vendedor só convidado; vendedor puro; viewer.
- **`availableActions`** (unit, web): matriz `isPayer`/`isApprover` × `requiresConfirmation` × `status`.
- **Endpoints `payments.ts`** (integração): dono+comprador com vendedor vinculado recebe **403** ao tentar `confirm`/`dispute` (regressão da brecha); contrato solo segue podendo confirmar.
- **Badge** (web): vendedor logado vê "vendedor"; dono+comprador vê "comprador" + "Dono".

## Fora de escopo (YAGNI)

- Revogar convite (DELETE) e reenvio de convite.
- Alterar `ownerRole` após a criação.
- Qualquer tratamento de papel `"neutral"` (não é criável hoje).
- Mudanças na máquina de estados de parcela (`installment-state.ts`).
