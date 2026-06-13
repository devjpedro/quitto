# Fase 5 — Papéis dinâmicos + refino do gerenciamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver a vaga real do usuário num contrato (em vez de colapsar o dono em `"owner"`), separando *gestão* (`isOwner`) de *capacidade de pagamento* (`isPayer`/`isApprover`), corrigir a badge de papel para ser dinâmica, e refinar o drawer de participantes (layout A).

**Architecture:** O backend passa a ser a fonte única de verdade da capacidade: `getContractRole` retorna `{ role, isOwner }` e um novo `getCapabilities` deriva `isPayer`/`isApprover` (capacidade segue a vaga; o dono herda o outro lado só enquanto a contraparte não tiver conta vinculada). O endpoint `GET /contracts/:id` expõe esses flags; o front apenas renderiza.

**Tech Stack:** Bun + ElysiaJS + Drizzle (api, testes `bun:test`); React 19 + TanStack Query + Eden treaty + Vitest/Testing Library (web); Radix via pacote `radix-ui`; Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-13-fase-5-papeis-dinamicos-design.md`

---

## File Structure

**Backend (`apps/api`):**
- `src/lib/contract-access.ts` — **modificar**: `getContractRole` → `{ role, isOwner }`; novo `getCapabilities`; tipos `ContractAccess`/`Capabilities`.
- `src/modules/payments.ts` — **modificar**: `loadInstallmentForUser` devolve capabilities; 5 endpoints trocam o gate.
- `src/modules/participants.ts` — **modificar**: `requireOwner` usa `isOwner`.
- `src/modules/contracts.ts` — **modificar**: GET devolve `role/isOwner/isPayer/isApprover` (+ schema); PATCH parcela usa `isOwner`.
- `tests/contract-access.test.ts` — **modificar**: novo shape + casos de `getCapabilities`.
- `tests/payments.test.ts` — **modificar**: regressão do 403.

**Web (`apps/web`):**
- `src/lib/installment-actions.ts` — **modificar**: assinatura de `availableActions`.
- `src/components/payment-actions.tsx` — **modificar**: prop `capabilities`.
- `src/components/installment-drawer.tsx` — **modificar**: props `isOwner` + `capabilities`.
- `src/routes/contract-detail.tsx` — **modificar**: `isOwner` da API; threading de capabilities; badge dinâmica.
- `src/components/ui/dropdown-menu.tsx` — **criar**: wrapper Radix.
- `src/components/participants-drawer.tsx` — **modificar**: redesenho do card (layout A).
- Testes: `installment-actions.test.ts`, `payment-actions.test.tsx`, `installment-drawer.test.tsx`, `contract-detail.test.tsx`, `participants-drawer.test.tsx`, + novo `dropdown-menu.test.tsx`.

---

## Task 1: Backend — resolução de vaga + capacidades

**Files:**
- Modify: `apps/api/src/lib/contract-access.ts`
- Modify: `apps/api/src/modules/payments.ts`
- Modify: `apps/api/src/modules/participants.ts:50-55`
- Modify: `apps/api/src/modules/contracts.ts:168-234` e `:268-276`
- Test: `apps/api/tests/contract-access.test.ts`, `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Reescrever os testes de `contract-access.test.ts` para o novo shape + capacidades**

Substituir TODO o conteúdo de `apps/api/tests/contract-access.test.ts` por:

```ts
import { describe, expect, it } from "bun:test";
import { db } from "../src/db/client";
import { contract, participant, user } from "../src/db/schema";
import { getCapabilities, getContractRole } from "../src/lib/contract-access";

const naoEncontradoRe = /não encontrado/i;

async function makeUser(id: string) {
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .onConflictDoNothing();
}

/** Cria um contrato + a linha de participante do dono (espelha o fluxo de create). */
async function makeContract(ownerId: string, ownerRole: "buyer" | "seller") {
  const rows = await db
    .insert(contract)
    .values({
      ownerId,
      title: "T",
      ownerRole,
      totalAmountCents: 1000,
      installmentsCount: 1,
    })
    .returning();
  const inserted = rows[0];
  if (!inserted) {
    throw new Error("insert did not return a row");
  }
  await db.insert(participant).values({
    contractId: inserted.id,
    displayName: ownerId,
    role: ownerRole,
    linkedUserId: ownerId,
  });
  return inserted.id;
}

describe("getContractRole", () => {
  it("devolve a vaga real + isOwner para o dono", async () => {
    const uid = `owner-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeContract(uid, "buyer");
    expect(await getContractRole(uid, cId)).toEqual({
      role: "buyer",
      isOwner: true,
    });
  });

  it("lança NotFound para estranho (não vaza existência)", async () => {
    const owner = `o2-${Date.now()}`;
    const stranger = `s2-${Date.now()}`;
    await makeUser(owner);
    await makeUser(stranger);
    const cId = await makeContract(owner, "seller");
    await expect(getContractRole(stranger, cId)).rejects.toThrow(
      naoEncontradoRe
    );
  });
});

describe("getCapabilities", () => {
  it("contrato solo: dono acumula pagador e aprovador", async () => {
    const uid = `solo-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeContract(uid, "buyer");
    const caps = await getCapabilities(uid, cId);
    expect(caps.isPayer).toBe(true);
    expect(caps.isApprover).toBe(true);
    expect(caps.isOwner).toBe(true);
  });

  it("dono+comprador com vendedor VINCULADO: dono só é pagador", async () => {
    const owner = `ob-${Date.now()}`;
    const seller = `sv-${Date.now()}`;
    await makeUser(owner);
    await makeUser(seller);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: seller,
    });
    const caps = await getCapabilities(owner, cId);
    expect(caps.isPayer).toBe(true);
    expect(caps.isApprover).toBe(false);
  });

  it("dono+comprador com vendedor só CONVIDADO (sem conta): dono ainda aprova", async () => {
    const owner = `oc-${Date.now()}`;
    await makeUser(owner);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Convidado",
      role: "seller",
      linkedUserId: null,
    });
    const caps = await getCapabilities(owner, cId);
    expect(caps.isApprover).toBe(true);
  });

  it("vendedor vinculado (não-dono): é aprovador, não pagador", async () => {
    const owner = `op-${Date.now()}`;
    const seller = `sp-${Date.now()}`;
    await makeUser(owner);
    await makeUser(seller);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: seller,
    });
    const caps = await getCapabilities(seller, cId);
    expect(caps.role).toBe("seller");
    expect(caps.isOwner).toBe(false);
    expect(caps.isApprover).toBe(true);
    expect(caps.isPayer).toBe(false);
  });

  it("viewer não é pagador nem aprovador", async () => {
    const owner = `ov-${Date.now()}`;
    const viewer = `vv-${Date.now()}`;
    await makeUser(owner);
    await makeUser(viewer);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Convidado",
      role: "viewer",
      linkedUserId: viewer,
    });
    const caps = await getCapabilities(viewer, cId);
    expect(caps.isPayer).toBe(false);
    expect(caps.isApprover).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `cd apps/api && bun test tests/contract-access.test.ts`
Expected: FAIL — `getCapabilities` não existe / `getContractRole` retorna string, não objeto.

- [ ] **Step 3: Reescrever `apps/api/src/lib/contract-access.ts`**

Substituir TODO o conteúdo por:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant } from "../db/schema";
import { NotFoundError } from "./errors";

export type ParticipantSlot = "buyer" | "seller" | "viewer";

export interface ContractAccess {
  /** Vaga real do usuário no contrato. */
  role: ParticipantSlot;
  /** Dono do contrato (gestão), derivado de contract.ownerId. */
  isOwner: boolean;
}

export interface Capabilities extends ContractAccess {
  /** Pode pagar/anexar comprovante/marcar paga. */
  isPayer: boolean;
  /** Pode confirmar/contestar. */
  isApprover: boolean;
}

/**
 * Resolve a vaga real do usuário + se ele é o dono. Lança NotFoundError quando o
 * contrato não existe OU o usuário não tem acesso (não vaza existência).
 */
export async function getContractRole(
  userId: string,
  contractId: string
): Promise<ContractAccess> {
  const found = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  const row = found[0];
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
  const isOwner = row.ownerId === userId;
  const link = await db
    .select()
    .from(participant)
    .where(
      and(
        eq(participant.contractId, contractId),
        eq(participant.linkedUserId, userId)
      )
    )
    .limit(1);
  const slot = link[0]?.role;
  if (slot && slot !== "owner") {
    return { role: slot, isOwner };
  }
  // Safety net: dono sem linha de participante (inconsistência legada) cai no ownerRole.
  if (isOwner) {
    return { role: row.ownerRole === "seller" ? "seller" : "buyer", isOwner: true };
  }
  throw new NotFoundError("Contrato não encontrado");
}

/**
 * Capacidade segue a vaga. O dono herda o lado oposto SOMENTE enquanto a outra
 * vaga não tiver contraparte com conta vinculada (linkedUserId !== null).
 */
export async function getCapabilities(
  userId: string,
  contractId: string
): Promise<Capabilities> {
  const access = await getContractRole(userId, contractId);
  const people = await db
    .select({
      role: participant.role,
      linkedUserId: participant.linkedUserId,
    })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  const hasLinkedBuyer = people.some(
    (p) => p.role === "buyer" && p.linkedUserId !== null
  );
  const hasLinkedSeller = people.some(
    (p) => p.role === "seller" && p.linkedUserId !== null
  );
  const isPayer = access.role === "buyer" || (access.isOwner && !hasLinkedBuyer);
  const isApprover =
    access.role === "seller" || (access.isOwner && !hasLinkedSeller);
  return { ...access, isPayer, isApprover };
}
```

- [ ] **Step 4: Atualizar `apps/api/src/modules/payments.ts` para usar capacidades**

Trocar o import (linha 12):
```ts
import { getCapabilities } from "../lib/contract-access";
```

Reescrever `loadInstallmentForUser` (linhas 29-48) para devolver `caps`:
```ts
/** Loads installment + parent contract and the caller's capabilities. Throws 404 if no access. */
async function loadInstallmentForUser(userId: string, installmentId: string) {
  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentId))
    .limit(1);
  if (!inst) {
    throw new NotFoundError("Parcela não encontrada");
  }
  const caps = await getCapabilities(userId, inst.contractId); // 404 se sem acesso
  const [c] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, inst.contractId))
    .limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return { inst, contract: c, caps };
}
```

Atualizar os 5 gates (em cada endpoint, trocar a desestruturação `role` por `caps` e o `if`):

- presign (linhas 55-61):
```ts
      const { inst, caps } = await loadInstallmentForUser(
        user.id,
        params.installmentId
      );
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }
```
- proofs (linhas 80-87): desestruturar `{ inst, contract: c, caps }` e:
```ts
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }
```
- confirm (linhas 157-164): desestruturar `{ inst, contract: c, caps }` e:
```ts
      if (!caps.isApprover) {
        throw new ForbiddenError("Apenas o vendedor/dono confirma");
      }
```
- dispute (linhas 197-204): desestruturar `{ inst, contract: c, caps }` e:
```ts
      if (!caps.isApprover) {
        throw new ForbiddenError("Apenas o vendedor/dono contesta");
      }
```
- mark-paid (linhas 235-242): desestruturar `{ inst, contract: c, caps }` e:
```ts
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono marca como paga");
      }
```

(O endpoint GET `/installments/:installmentId` na linha 271 desestrutura só `{ inst }` — mantém.)

- [ ] **Step 5: Atualizar `apps/api/src/modules/participants.ts` `requireOwner`**

Substituir `requireOwner` (linhas 50-55) por:
```ts
async function requireOwner(userId: string, contractId: string) {
  const { isOwner } = await getContractRole(userId, contractId); // 404 se sem acesso
  if (!isOwner) {
    throw new ForbiddenError("Apenas o dono gerencia participantes");
  }
}
```

- [ ] **Step 6: Atualizar `apps/api/src/modules/contracts.ts` (GET detalhe + PATCH parcela)**

No GET `/contracts/:id` (linha 172) trocar:
```ts
      const access = await getCapabilities(user.id, params.id); // lança 404 se sem acesso
```
No `return` (linha 193) substituir o início do objeto:
```ts
      return {
        role: access.role,
        isOwner: access.isOwner,
        isPayer: access.isPayer,
        isApprover: access.isApprover,
        contract: {
```
No `response` TypeBox (logo após `response: t.Object({` na linha ~230) adicionar abaixo de `role: t.String(),`:
```ts
        isOwner: t.Boolean(),
        isPayer: t.Boolean(),
        isApprover: t.Boolean(),
```
Trocar o import (linha 5) para incluir ambos:
```ts
import { getCapabilities, getContractRole } from "../lib/contract-access";
```
No PATCH `/contracts/:id/installments/:installmentId` (linhas 272-274) trocar:
```ts
      const { isOwner } = await getContractRole(user.id, params.id);
      if (!isOwner) {
        throw new ForbiddenError("Apenas o dono edita parcelas");
      }
```

- [ ] **Step 7: Adicionar a regressão do 403 em `apps/api/tests/payments.test.ts`**

Adicionar, no topo do arquivo, ao lado dos outros imports:
```ts
import { db } from "../src/db/client";
import { participant } from "../src/db/schema";
```
E adicionar este bloco no fim do arquivo (não depende de S3 — o gate de autorização roda antes da transição de estado):
```ts
async function meId(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/me", { headers: { cookie } })
  );
  return (await res.json()).id as string;
}

describe("autorização por capacidade (dono+comprador com vendedor vinculado)", () => {
  it("dono+comprador recebe 403 ao confirmar quando há vendedor vinculado", async () => {
    const ownerCookie = await signUpCookie("cap-owner");
    const cId = await createContract(ownerCookie, true); // ownerRole: "buyer"
    const sellerCookie = await signUpCookie("cap-seller");
    const sellerId = await meId(sellerCookie);
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: sellerId,
    });
    const iId = await firstInstallmentId(ownerCookie, cId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/confirm`, {
        method: "POST",
        headers: { cookie: ownerCookie },
      })
    );
    expect(res.status).toBe(403);
  });
});
```
Nota: este `describe` NÃO usa `describe.if(configured)` — roda sempre (não toca storage).

- [ ] **Step 8: Rodar a suíte da API e o typecheck**

Run: `cd apps/api && bun test tests/contract-access.test.ts tests/payments.test.ts tests/participants.test.ts tests/contracts.test.ts`
Expected: PASS (os casos de capacidade verdes; o 403 verde).

Run: `bun run --filter @quitto/api typecheck`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lib/contract-access.ts apps/api/src/modules/payments.ts apps/api/src/modules/participants.ts apps/api/src/modules/contracts.ts apps/api/tests/contract-access.test.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): resolve vaga real + capacidades (isPayer/isApprover), separa de isOwner"
```

---

## Task 2: Web — ações de pagamento orientadas a capacidade

**Files:**
- Modify: `apps/web/src/lib/installment-actions.ts`
- Test: `apps/web/tests/installment-actions.test.ts`
- Modify: `apps/web/src/components/payment-actions.tsx`
- Test: `apps/web/tests/payment-actions.test.tsx`
- Modify: `apps/web/src/components/installment-drawer.tsx`
- Test: `apps/web/tests/installment-drawer.test.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx:69-70`, `:194-201`
- Test: `apps/web/tests/contract-detail.test.tsx`

- [ ] **Step 1: Reescrever `apps/web/tests/installment-actions.test.ts`**

Substituir TODO o conteúdo por (a assinatura passa a receber `{ isPayer, isApprover }`):

```ts
import { describe, expect, it } from "vitest";
import { availableActions } from "../src/lib/installment-actions";

const payer = { isPayer: true, isApprover: false };
const approver = { isPayer: false, isApprover: true };
const both = { isPayer: true, isApprover: true };
const none = { isPayer: false, isApprover: false };

describe("availableActions — com confirmação", () => {
  it("pagador envia comprovante em pending", () => {
    const a = availableActions(payer, true, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canConfirm).toBe(false);
    expect(a.canMarkPaid).toBe(false);
  });

  it("aprovador confirma/contesta em awaiting_confirmation", () => {
    const a = availableActions(approver, true, "awaiting_confirmation");
    expect(a.canConfirm).toBe(true);
    expect(a.canDispute).toBe(true);
    expect(a.canUpload).toBe(false);
  });

  it("pagador reenvia comprovante em disputed", () => {
    expect(availableActions(payer, true, "disputed").canUpload).toBe(true);
  });

  it("nenhuma ação em confirmed", () => {
    expect(availableActions(both, true, "confirmed")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("aprovador não envia comprovante; pagador não confirma", () => {
    expect(availableActions(approver, true, "pending").canUpload).toBe(false);
    expect(
      availableActions(payer, true, "awaiting_confirmation").canConfirm
    ).toBe(false);
  });
});

describe("availableActions — sem confirmação", () => {
  it("pagador pode enviar comprovante OU marcar paga em pending", () => {
    const a = availableActions(payer, false, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canMarkPaid).toBe(true);
    expect(a.canConfirm).toBe(false);
  });

  it("mark-paid só faz sentido sem confirmação", () => {
    expect(availableActions(payer, true, "pending").canMarkPaid).toBe(false);
  });
});

describe("availableActions — dois lados e sem capacidade", () => {
  it("quem tem os dois lados (solo) envia e confirma", () => {
    expect(availableActions(both, true, "pending").canUpload).toBe(true);
    expect(
      availableActions(both, true, "awaiting_confirmation").canConfirm
    ).toBe(true);
  });

  it("sem capacidade (viewer) nunca tem ações", () => {
    expect(availableActions(none, true, "awaiting_confirmation")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && bun run vitest run tests/installment-actions.test.ts`
Expected: FAIL — `availableActions` ainda recebe `role: string`.

- [ ] **Step 3: Reescrever `apps/web/src/lib/installment-actions.ts`**

Substituir TODO o conteúdo por:
```ts
import { INSTALLMENT_STATUS } from "@quitto/shared";

export interface Capabilities {
  isPayer: boolean;
  isApprover: boolean;
}

export interface InstallmentActions {
  canConfirm: boolean;
  canDispute: boolean;
  /** marcar como paga (fluxo sem confirmação) */
  canMarkPaid: boolean;
  /** enviar/reenviar comprovante */
  canUpload: boolean;
}

/**
 * Espelho de UI do RBAC do backend (a autoridade). `isPayer`/`isApprover`
 * vêm prontos da API (GET /contracts/:id).
 */
export function availableActions(
  caps: Capabilities,
  requiresConfirmation: boolean,
  status: string
): InstallmentActions {
  const awaiting =
    requiresConfirmation && status === INSTALLMENT_STATUS.awaitingConfirmation;
  return {
    canUpload:
      caps.isPayer &&
      (status === INSTALLMENT_STATUS.pending ||
        status === INSTALLMENT_STATUS.disputed),
    canMarkPaid:
      caps.isPayer &&
      !requiresConfirmation &&
      status === INSTALLMENT_STATUS.pending,
    canConfirm: caps.isApprover && awaiting,
    canDispute: caps.isApprover && awaiting,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && bun run vitest run tests/installment-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar `payment-actions.tsx` para receber `capabilities`**

Trocar o import (linha 11) e a assinatura. Substituir as linhas 6-26:
```ts
import {
  useConfirmPaymentMutation,
  useDisputePaymentMutation,
  useMarkPaidMutation,
} from "@/hooks/use-payment-mutations";
import { type Capabilities, availableActions } from "@/lib/installment-actions";

export function PaymentActions({
  contractId,
  installmentId,
  capabilities,
  requiresConfirmation,
  status,
}: {
  contractId: string;
  installmentId: string;
  capabilities: Capabilities;
  requiresConfirmation: boolean;
  status: string;
}) {
  const actions = availableActions(capabilities, requiresConfirmation, status);
```
(O resto do componente não muda.)

- [ ] **Step 6: Atualizar `payment-actions.test.tsx` para o novo prop**

Trocar cada `contractRole="..."` pelos capabilities equivalentes:
- linha 43-44 (`contractRole="seller"`) → `capabilities={{ isPayer: false, isApprover: true }}`
- linha 60-61 (`contractRole="seller"`) → `capabilities={{ isPayer: false, isApprover: true }}`
- linha 82-83 (`contractRole="buyer"`) → `capabilities={{ isPayer: true, isApprover: false }}`
- linha 102-103 (`contractRole="viewer"`) → `capabilities={{ isPayer: false, isApprover: false }}`

- [ ] **Step 7: Atualizar `installment-drawer.tsx` (props `isOwner` + `capabilities`)**

Trocar o import de `installment-actions` (linha 27):
```ts
import { type Capabilities, availableActions } from "@/lib/installment-actions";
```
Remover `PARTICIPANT_ROLE` do import de `@quitto/shared` (linhas 2-7) — passa a:
```ts
import {
  INSTALLMENT_STATUS,
  type UpdateInstallmentInput,
  updateInstallmentSchema,
} from "@quitto/shared";
```
Em `InstallmentDetailView` (assinatura linhas 113-131) trocar `contractRole: string` por:
```ts
  isOwner: boolean;
  capabilities: Capabilities;
```
e remover `contractRole`. Trocar a linha 132:
```ts
  const actions = availableActions(capabilities, requiresConfirmation, status);
```
Trocar o gate do botão editar (linha 151):
```ts
      {isOwner ? (
```
Trocar o uso de `PaymentActions` (linhas 174-180):
```ts
      <PaymentActions
        capabilities={capabilities}
        contractId={contractId}
        installmentId={installment.id}
        requiresConfirmation={requiresConfirmation}
        status={status}
      />
```
Em `InstallmentDrawer` (assinatura linhas 199-213) trocar `contractRole: string` por:
```ts
  isOwner: boolean;
  capabilities: Capabilities;
```
e na renderização de `InstallmentDetailView` (linhas 256-265) trocar `contractRole={contractRole}` por:
```ts
            capabilities={capabilities}
            isOwner={isOwner}
```

- [ ] **Step 8: Atualizar `contract-detail.tsx` (isOwner da API + threading)**

Trocar a linha 70:
```ts
  const isOwner = data.isOwner;
```
Remover o import `PARTICIPANT_ROLE` (linha 1) se não for mais usado em nenhum outro ponto do arquivo:
```ts
import { isOverdue } from "@quitto/shared";
```
Trocar a chamada de `InstallmentDrawer` (linhas 194-201):
```ts
      <InstallmentDrawer
        capabilities={{ isPayer: data.isPayer, isApprover: data.isApprover }}
        contractId={contract.id}
        installment={selected}
        isOwner={data.isOwner}
        onClose={() => setOpenId(null)}
        open={openId !== null}
        requiresConfirmation={contract.requiresConfirmation}
      />
```

- [ ] **Step 9: Atualizar `installment-drawer.test.tsx` e `contract-detail.test.tsx` mocks**

Em `installment-drawer.test.tsx`, trocar nos 3 renders:
- `contractRole="owner"` → `capabilities={{ isPayer: true, isApprover: true }} isOwner`
- `contractRole="viewer"` → `capabilities={{ isPayer: false, isApprover: false }} isOwner={false}`

Em `contract-detail.test.tsx`, adicionar ao objeto `detail` (após `role: "owner",` na linha 18) os flags de topo:
```ts
  isOwner: true,
  isPayer: true,
  isApprover: true,
```
No teste "não mostra Gerenciar para não-dono" (linhas 82-91), trocar o override para refletir o novo gate:
```ts
      data: { ...detail, role: "viewer", isOwner: false },
```

- [ ] **Step 10: Rodar a suíte web afetada + typecheck**

Run: `cd apps/web && bun run vitest run tests/installment-actions.test.ts tests/payment-actions.test.tsx tests/installment-drawer.test.tsx tests/contract-detail.test.tsx`
Expected: PASS.

Run: `bun run --filter @quitto/web typecheck`
Expected: sem erros (o Eden treaty já propaga `isOwner/isPayer/isApprover` do response da API).

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/installment-actions.ts apps/web/src/components/payment-actions.tsx apps/web/src/components/installment-drawer.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/installment-actions.test.ts apps/web/tests/payment-actions.test.tsx apps/web/tests/installment-drawer.test.tsx apps/web/tests/contract-detail.test.tsx
git commit -m "feat(web): ações de pagamento seguem isPayer/isApprover da API"
```

---

## Task 3: Web — badge de papel dinâmica

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx:80-90`
- Test: `apps/web/tests/contract-detail.test.tsx`

- [ ] **Step 1: Adicionar testes da badge dinâmica**

Em `apps/web/tests/contract-detail.test.tsx`, adicionar dois testes dentro do `describe`:
```ts
  it("mostra o papel do usuário logado na badge (vendedor)", () => {
    useContractQuery.mockReturnValue({
      data: { ...detail, role: "seller", isOwner: false },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByText("vendedor")).toBeInTheDocument();
  });

  it("mostra papel + tag Dono no header quando isOwner", () => {
    useContractQuery.mockReturnValue({
      data: { ...detail, role: "buyer", isOwner: true },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByText("comprador")).toBeInTheDocument();
    // "Dono" aparece no header e na lista de participantes; basta existir ≥1
    expect(screen.getAllByText("Dono").length).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && bun run vitest run tests/contract-detail.test.tsx -t "papel do usuário logado"`
Expected: FAIL — a badge ainda mostra `contract.ownerRole`.

- [ ] **Step 3: Trocar a badge no header**

Em `apps/web/src/routes/contract-detail.tsx`, substituir o bloco (linhas 81-83):
```tsx
          <Badge tone="neutral">{ROLE_LABEL[data.role] ?? data.role}</Badge>
          {data.isOwner ? (
            <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge>
          ) : null}
```
(`ROLE_LABEL` e `OWNER_BADGE_LABEL` já estão importados na linha 14.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && bun run vitest run tests/contract-detail.test.tsx`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/contract-detail.tsx apps/web/tests/contract-detail.test.tsx
git commit -m "feat(web): badge do header mostra o papel do usuário logado + tag Dono"
```

---

## Task 4: Web — componente `ui/dropdown-menu.tsx`

**Files:**
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Test: `apps/web/tests/dropdown-menu.test.tsx`

- [ ] **Step 1: Escrever o teste**

Criar `apps/web/tests/dropdown-menu.test.tsx`:
```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import { renderWithProviders } from "./test-utils";

describe("DropdownMenu", () => {
  it("abre via clique no gatilho e dispara o item", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Ações">⋯</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Remover</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByRole("button", { name: /ações/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: /remover/i })
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /remover/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && bun run vitest run tests/dropdown-menu.test.tsx`
Expected: FAIL — módulo `ui/dropdown-menu` não existe.

- [ ] **Step 3: Criar o componente**

Criar `apps/web/src/components/ui/dropdown-menu.tsx`:
```tsx
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-background p-1 text-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        sideOffset={4}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && bun run vitest run tests/dropdown-menu.test.tsx`
Expected: PASS.

> Contingência (jsdom): se o `menuitem` não aparecer após o clique, o Radix Menu pode exigir `await userEvent.keyboard("{Enter}")` no gatilho focado, ou abrir com `screen.getByRole("menu")` como âncora do `within`. Ajustar o teste, não o componente.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/dropdown-menu.tsx apps/web/tests/dropdown-menu.test.tsx
git commit -m "feat(web): componente ui/dropdown-menu (Radix)"
```

---

## Task 5: Web — redesenho do card de participante (layout A)

**Files:**
- Modify: `apps/web/src/components/participants-drawer.tsx:147-255` (`ParticipantItem`)
- Test: `apps/web/tests/participants-drawer.test.tsx`

- [ ] **Step 1: Ajustar os testes do drawer para ações dentro do menu ⋯**

Em `apps/web/tests/participants-drawer.test.tsx`, os botões "Convidar"/"Remover" agora ficam dentro do menu ⋯. Atualizar os dois testes que os acionam:

No teste "gera o link de convite..." (linha 75), antes do clique em Convidar, abrir o menu:
```ts
    await import("@testing-library/user-event").then(async ({ default: ue }) => {
      await ue.click(screen.getByRole("button", { name: /ações de maria/i }));
    });
    fireEvent.click(screen.getByRole("menuitem", { name: INVITE_ACTION }));
```
(Substitui a linha `fireEvent.click(screen.getByRole("button", { name: INVITE_ACTION }));`.)

No teste "remove participante após confirmação" (linha 156), antes do clique em Remover:
```ts
    await import("@testing-library/user-event").then(async ({ default: ue }) => {
      await ue.click(screen.getByRole("button", { name: /ações de maria/i }));
    });
    fireEvent.click(screen.getByRole("menuitem", { name: REMOVE_ACTION }));
```
(Substitui a linha `fireEvent.click(screen.getByRole("button", { name: REMOVE_ACTION }));`.)

O `REMOVE_ACTION = /remover/i` casa "Remover participante" no menuitem; o `REMOVE_CONFIRM_ACTION = /^remover$/i` segue casando o botão do Dialog. O teste do `combobox` (Select de papel) continua válido — o Select permanece, agora num campo rotulado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && bun run vitest run tests/participants-drawer.test.tsx`
Expected: FAIL — não há `menuitem` (ações ainda são botões inline).

- [ ] **Step 3: Reescrever `ParticipantItem` (layout A)**

Em `apps/web/src/components/participants-drawer.tsx`, adicionar aos imports (junto aos outros de `@/components/ui`):
```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```
e o ícone:
```ts
import { MoreHorizontal } from "lucide-react";
```
Substituir TODO o corpo de `ParticipantItem` (linhas 162-254, o `return (...)`) por:
```tsx
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${participant.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
        <span className="font-medium text-foreground text-sm">
          {participant.displayName}
        </span>
        {isOwner ? <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge> : null}
        {participant.linked ? null : (
          <Badge tone="neutral">pendente</Badge>
        )}
        {isOwner ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações de ${participant.displayName}`}
              asChild
            >
              <Button className="ml-auto" size="icon-sm" type="button" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {participant.linked ? null : (
                <DropdownMenuItem onSelect={() => setInviting((v) => !v)}>
                  Convidar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
                Remover participante
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`role-${participant.id}`}>Papel</Label>
        <Select
          disabled={updateRole.isPending}
          onValueChange={(role) =>
            updateRole.mutateAsync({
              participantId: participant.id,
              role: role as AssignableRole,
            })
          }
          value={participant.role}
        >
          <SelectTrigger
            aria-label={`Papel de ${participant.displayName}`}
            id={`role-${participant.id}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {inviting && !participant.linked ? (
        <InvitePanel contractId={contractId} participantId={participant.id} />
      ) : null}

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description={`Remover ${participant.displayName} deste contrato? Convites pendentes serão cancelados.`}
          title="Remover participante"
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={removeMutation.isPending}
              onClick={async () => {
                await removeMutation.mutateAsync(participant.id);
                setConfirmOpen(false);
              }}
              type="button"
              variant="destructive"
            >
              {removeMutation.isPending ? "Removendo…" : "Remover"}
            </Button>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
```
Nota: o `Select` perde o `className="h-7 w-auto..."` antigo e usa o estilo padrão (largura total) do `SelectTrigger`. Confirmar que `Label` já está importado (está, linha 16).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && bun run vitest run tests/participants-drawer.test.tsx`
Expected: PASS. (Se o menu não abrir no jsdom, aplicar a contingência da Task 4 Step 4.)

- [ ] **Step 5: Verificar a suíte web inteira + typecheck + lint**

Run: `cd apps/web && bun run vitest run`
Expected: PASS (toda a suíte).

Run: `bun run --filter @quitto/web typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/participants-drawer.tsx apps/web/tests/participants-drawer.test.tsx
git commit -m "feat(web): redesenho do card de participante (campo Papel rotulado + menu de ações)"
```

---

## Task 6: Verificação final

- [ ] **Step 1: Suíte completa + typecheck do monorepo**

Run: `bun run test` (ou `turbo run test typecheck` a partir da raiz)
Expected: todos os pacotes verdes.

- [ ] **Step 2: Smoke manual (opcional, recomendado)**

Subir api + web e validar:
- Logado como vendedor: header mostra "vendedor"; numa parcela em `awaiting_confirmation`, vê "Confirmar/Contestar".
- Logado como dono+comprador com vendedor vinculado: header mostra "comprador" + "Dono"; NÃO vê "Confirmar/Contestar"; vê "Marcar como paga"/upload.
- Contrato solo (só o dono): vê todas as ações.
- Drawer de participantes: card com campo "Papel" e menu ⋯ com Convidar/Remover.

---

## Self-Review

**1. Cobertura da spec:**
- Seção 1 (resolução de vaga + capacidade) → Task 1. ✅
- Seção 2 (ações de pagamento) → Task 2. ✅
- Seção 3 (badge dinâmica) → Task 3. ✅
- Seção 4 (drawer layout A) → Tasks 4 + 5. ✅
- Testes (getCapabilities, availableActions, endpoint 403, badge) → Tasks 1, 2, 3. ✅
- Fora de escopo respeitado (sem DELETE de convite, sem editar ownerRole, sem neutral). ✅

**2. Placeholders:** nenhum — todo passo tem código/comando/saída esperada.

**3. Consistência de tipos:** `Capabilities` definido em `contract-access.ts` (backend) e em `installment-actions.ts` (web, espelho `{ isPayer, isApprover }`); `availableActions(caps, ...)` casa com os call sites em `payment-actions.tsx` e `installment-drawer.tsx`; `getContractRole` retorna `{ role, isOwner }` consumido em payments/participants/contracts; o GET expõe `role/isOwner/isPayer/isApprover` consumidos em `contract-detail.tsx`.
