# Fase 7f — Excluir / sair de contrato — Design

**Data:** 2026-06-14
**Escopo:** API (`apps/api`) + Web (`apps/web`).
**Origem:** dogfooding — faltam duas ações de ciclo de vida do contrato: o dono excluir, e um participante sair.

## Objetivo

Dar ao dono a ação de **excluir** um contrato e a participantes não-donos a ação de **sair** de um contrato. Hoje nenhuma das duas existe (nem endpoint, nem UI). Já existe owner removendo *outros* participantes (`DELETE /api/contracts/:id/participants/:participantId`, owner-only).

## Convenções

Código em inglês; sem literais espalhados; RBAC por contrato sem vazar (404 para quem não pode ver). Toda escrita passa por `invalidateContractViews` (coerência de cache, Fase 7a). Decisões já tomadas: hard delete com confirmação simples; qualquer participante não-dono pode sair.

---

## Modelo de domínio (existente, para contexto)

- Propriedade via `contract.ownerId` (FK de user) + flag `isOwner` derivada; o dono ocupa um slot de participante (buyer/seller) conforme `contract.ownerRole`.
- Slots: `buyer`/`seller` (únicos por contrato), `viewer` (ilimitado). Contrato pode ser solo (só o dono).
- RBAC em `apps/api/src/lib/contract-access.ts` (`getContractRole`, `requireOwner`).
- Cascatas no schema (`db/schema.ts`) com `onDelete: "cascade"` de `contract` para: `installment` → `proof`, `participant`, `auditEvent`, `invite`, `notification`. `participant.linkedUserId` é `set null` (apaga user ≠ apaga slot).
- Padrão de purga de arquivos: `DELETE /api/me` (`modules/account.ts`) coleta as chaves R2 e chama `storage.deleteObjects` best-effort (try/catch — nunca falha a operação principal).

---

## Parte 1 — API

### 1.1 Excluir contrato — `DELETE /api/contracts/:id`
- **Autorização:** owner-only via `requireOwner` (compara `ownerId`). Não-dono/inexistente → **404** (sem vazar existência).
- **Fluxo:**
  1. Coletar as chaves de storage (R2) de todos os comprovantes (`proof`) das parcelas do contrato — **antes** de apagar.
  2. Deletar o contrato. A cascata do schema remove installments/proofs/participants/audit/invites/notifications.
  3. Purgar as chaves R2 best-effort (`storage.deleteObjects` em try/catch; falha de R2 não falha a exclusão).
- **Resposta:** sucesso simples (204 sem corpo, ou `{ ok: true }` — decisão do plano, alinhada ao padrão dos outros endpoints).
- **Auditoria:** o contrato some inteiro, então não há trilha a preservar (consistente com hard delete).

### 1.2 Sair do contrato — `DELETE /api/contracts/:id/participants/me`
- **Autorização:** o caller precisa ser participante **vinculado** (`linkedUserId === user.id`) e **não-dono**.
  - Dono → **403** (mensagem orientando a excluir o contrato).
  - Não-participante / contrato inexistente → **404** (sem vazar).
- **Fluxo:** apaga o slot do próprio participante (libera a vaga buyer/seller, como na remoção feita pelo dono). Evento de auditoria `participant_left` (reaproveitar o tipo de auditoria de remoção, ou adicionar um label centralizado — sem literal cru).
- **Resposta:** sucesso simples.

### 1.3 Testes de API
- Excluir: dono exclui com sucesso; não-dono recebe 404; **as chaves R2 corretas são coletadas/purgadas** (verificar o conjunto passado ao storage); cascata observável (parcelas somem).
- Sair: participante não-dono sai com sucesso (slot some, vaga liberada); dono → 403; não-participante → 404.

---

## Parte 2 — Web

### 2.1 Mutations
- `useDeleteContractMutation()` — chama o DELETE; `onSuccess`: `invalidateContractViews(qc)` + navega para a lista de contratos.
- `useLeaveContractMutation(contractId)` — chama o DELETE de `participants/me`; `onSuccess`: `invalidateContractViews(qc)` + navega para a lista.

### 2.2 UI — tela de detalhe do contrato
- Menu de ações no header (reaproveitar `ui/dropdown-menu`):
  - **dono:** item destrutivo "Excluir contrato".
  - **não-dono:** item "Sair do contrato".
- **Confirmação:** modal simples confirmar/cancelar (reusar o padrão de confirmação já existente no app — ex.: o usado em "Marcar como paga"/remoção de participante). Texto: ação permanente.
- Sucesso → toast + navegação para a lista (a invalidação já atualiza dashboard/lista).

### 2.3 Testes de Web
- `useDeleteContractMutation`/`useLeaveContractMutation` invalidam as views e navegam (mock do treaty + spy de navegação/invalidate).
- O menu mostra a ação certa conforme papel (dono vê "Excluir", não-dono vê "Sair").

---

## Decomposição em unidades
- API delete: handler + coleta de chaves R2 + purga (espelha `account.ts`).
- API leave: handler reaproveitando a lógica de remoção de slot, com authz de self/não-dono.
- Web: dois hooks de mutation + o menu/confirmação no detalhe.

## Fora de escopo
- Soft delete / arquivamento (decidido: hard delete).
- Transferência de propriedade.
- Dono "sair" (deve excluir).
- Bloqueio de saída por atividade/pagamentos (decidido: qualquer não-dono pode sair).
