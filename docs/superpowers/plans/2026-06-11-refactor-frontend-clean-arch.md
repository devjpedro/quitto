# Refactor — Clean Architecture do Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:react-clean-architecture` (princípios) + `superpowers:subagent-driven-development` (execução). Steps usam checkbox (`- [ ]`). Refator com **rede de testes**: a suíte atual (≈108 testes) deve seguir verde a cada tarefa; só extrações/movimentações, **sem mudar comportamento**.

**Goal:** Eliminar valores mágicos e lógica em arquivos de UI no front: criar **fonte única** de constantes de domínio em `@quitto/shared` (consumida por API e web), centralizar **labels/tones** de apresentação na web, extrair lógica para `lib`/hooks, e remover as três cópias divergentes do conceito de "pago/atrasado".

**Architecture:** `@quitto/shared` passa a expor as **constantes de domínio** (`INSTALLMENT_STATUS`, `CONTRACT_STATUS`, `OWNER_ROLE`, `PARTICIPANT_ROLE`, `AUDIT_TYPE`) como objetos `as const` + tipos derivados + os Zod enums derivados deles, e **predicados puros** (`isPaidStatus`, `isOverdue`). A web mantém um único `lib/labels.ts` (pt-BR + tones — camada de apresentação) e consome as constantes. Componentes ficam finos: comparações via constantes nomeadas; derivação em `lib`/hooks.

**Tech Stack:** TypeScript, Zod (`@quitto/shared`), Elysia/Drizzle (API consumidora), React + shadcn (web).

> **Convenção (spec §9 + memória):** código/identificadores/comentários em inglês; conteúdo (labels) em pt-BR; **sem literais de domínio em comparações** — sempre constante nomeada.
> **Pré-requisitos:** Fases 0–3 em `develop`. Branch `refactor/frontend-clean-arch` a partir de `develop`. Postgres (+ MinIO se for rodar a suíte da API). Ao fim, merge em `develop`.

---

## Task 1: `@quitto/shared` — constantes de domínio + predicados (TDD)

**Files:**
- Create: `packages/shared/src/domain.ts`
- Modify: `packages/shared/src/index.ts` (re-exporta + deriva `ownerRoleSchema`)
- Test: `packages/shared/tests/domain.test.ts` (criar pasta/arquivo)

- [ ] **Step 1: Criar `packages/shared/src/domain.ts`**

```ts
// Single source of truth for domain value sets, shared by API and web.

export const INSTALLMENT_STATUS = {
  pending: "pending",
  awaitingConfirmation: "awaiting_confirmation",
  confirmed: "confirmed",
  disputed: "disputed",
  paid: "paid",
} as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];
export const INSTALLMENT_STATUSES = Object.values(INSTALLMENT_STATUS) as [
  InstallmentStatus,
  ...InstallmentStatus[],
];

export const CONTRACT_STATUS = {
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
} as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];
export const CONTRACT_STATUSES = Object.values(CONTRACT_STATUS) as [
  ContractStatus,
  ...ContractStatus[],
];

export const OWNER_ROLE = { buyer: "buyer", seller: "seller", neutral: "neutral" } as const;
export type OwnerRole = (typeof OWNER_ROLE)[keyof typeof OWNER_ROLE];
export const OWNER_ROLES = Object.values(OWNER_ROLE) as [OwnerRole, ...OwnerRole[]];

export const PARTICIPANT_ROLE = {
  owner: "owner",
  buyer: "buyer",
  seller: "seller",
  viewer: "viewer",
} as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLE)[keyof typeof PARTICIPANT_ROLE];

export const AUDIT_TYPE = {
  proofSubmitted: "proof_submitted",
  paymentConfirmed: "payment_confirmed",
  paymentDisputed: "payment_disputed",
  installmentPaid: "installment_paid",
} as const;
export type AuditType = (typeof AUDIT_TYPE)[keyof typeof AUDIT_TYPE];

const PAID_STATUSES: ReadonlySet<string> = new Set([
  INSTALLMENT_STATUS.paid,
  INSTALLMENT_STATUS.confirmed,
]);

/** True when the installment counts as paid (paid or confirmed). */
export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status);
}

/**
 * Single definition of "overdue": past due, not paid, and not awaiting confirmation
 * (a submitted proof shouldn't read as overdue while it waits).
 */
export function isOverdue(dueDate: string, status: string, todayISO: string): boolean {
  return (
    dueDate < todayISO &&
    !isPaidStatus(status) &&
    status !== INSTALLMENT_STATUS.awaitingConfirmation
  );
}
```

- [ ] **Step 2: Escrever o teste dos predicados**

Create `packages/shared/tests/domain.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { INSTALLMENT_STATUS, isOverdue, isPaidStatus } from "../src/domain";

describe("domain predicates", () => {
  it("isPaidStatus cobre paid e confirmed", () => {
    expect(isPaidStatus(INSTALLMENT_STATUS.paid)).toBe(true);
    expect(isPaidStatus(INSTALLMENT_STATUS.confirmed)).toBe(true);
    expect(isPaidStatus(INSTALLMENT_STATUS.pending)).toBe(false);
  });

  it("isOverdue: vencida e pendente é atrasada", () => {
    expect(isOverdue("2026-01-01", INSTALLMENT_STATUS.pending, "2026-02-01")).toBe(true);
  });

  it("isOverdue: aguardando confirmação não é atrasada", () => {
    expect(isOverdue("2026-01-01", INSTALLMENT_STATUS.awaitingConfirmation, "2026-02-01")).toBe(false);
  });

  it("isOverdue: antes do vencimento não é atrasada", () => {
    expect(isOverdue("2026-03-01", INSTALLMENT_STATUS.pending, "2026-02-01")).toBe(false);
  });
});
```

> O pacote `shared` ainda não tinha pasta de testes; confirme que `bun test` roda em `packages/shared` (script `"test": "bun test"` no `package.json` do shared; se não existir, adicione).

- [ ] **Step 3: Re-exportar de `index.ts` e derivar o Zod enum**

Em `packages/shared/src/index.ts`: adicione no topo `export * from "./domain";` e troque a definição de `ownerRoleSchema` para derivar das constantes:

```ts
import { OWNER_ROLES } from "./domain";
// ...
export const ownerRoleSchema = z.enum(OWNER_ROLES);
```

- [ ] **Step 4: Rodar testes do shared + typecheck do monorepo**

Run: `bun --filter @quitto/shared test && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain.ts packages/shared/src/index.ts packages/shared/tests/domain.test.ts packages/shared/package.json
git commit -m "feat(shared): constantes de domínio + predicados isPaidStatus/isOverdue"
```

---

## Task 2: API consome as constantes (estado + progresso)

> Remove a cópia divergente de "pago/atrasado" no back e os literais da máquina de estados.

**Files:**
- Modify: `apps/api/src/lib/installment-state.ts`
- Modify: `apps/api/src/lib/contract-progress.ts`

- [ ] **Step 1: `installment-state.ts` — usar o tipo/constantes do shared**

Troque o `export type InstallmentStatus = ...` por import do shared e use as constantes nas comparações:

```ts
import { INSTALLMENT_STATUS, type InstallmentStatus } from "@quitto/shared";
import { ValidationError } from "./errors";

export type InstallmentAction = "submit_proof" | "confirm" | "dispute" | "mark_paid";
```

Nas transições, troque os literais por `INSTALLMENT_STATUS.pending`, `.awaitingConfirmation`, `.confirmed`, `.disputed`, `.paid` (mesma lógica, sem string solta). Mantenha a assinatura `nextStatus(current, action, requiresConfirmation)`.

- [ ] **Step 2: `contract-progress.ts` — usar `isPaidStatus` + `isOverdue` do shared**

Remova o `PAID_STATUSES` local e a lógica inline de atraso; importe do shared:

```ts
import { INSTALLMENT_STATUS, isOverdue, isPaidStatus, type InstallmentStatus } from "@quitto/shared";
```

No loop, `const paid = isPaidStatus(item.status)` e `if (!paid && isOverdue(item.dueDate, item.status, todayISO)) overdueCount++`. (O `InstallmentLike.status` pode tipar como `InstallmentStatus`.)

- [ ] **Step 3: Rodar a suíte da API**

Run (com Postgres + MinIO + envs): `bun --filter @quitto/api test`
Expected: PASS (sem mudança de comportamento; `installment-state` e `contract-progress` cobertos).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/installment-state.ts apps/api/src/lib/contract-progress.ts
git commit -m "refactor(api): estado e progresso usam constantes/predicados do shared"
```

---

## Task 3: Web — camada de apresentação única (`lib/labels.ts`)

**Files:**
- Create: `apps/web/src/lib/labels.ts`

- [ ] **Step 1: Criar `apps/web/src/lib/labels.ts`** (única fonte de labels pt-BR + tones)

```ts
import {
  CONTRACT_STATUS,
  INSTALLMENT_STATUS,
  PARTICIPANT_ROLE,
  type ContractStatus,
  type InstallmentStatus,
} from "@quitto/shared";

type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  [INSTALLMENT_STATUS.pending]: "pendente",
  [INSTALLMENT_STATUS.awaitingConfirmation]: "aguardando",
  [INSTALLMENT_STATUS.confirmed]: "confirmada",
  [INSTALLMENT_STATUS.disputed]: "contestada",
  [INSTALLMENT_STATUS.paid]: "paga",
};

export const INSTALLMENT_STATUS_TONE: Record<InstallmentStatus, Tone> = {
  [INSTALLMENT_STATUS.pending]: "warning",
  [INSTALLMENT_STATUS.awaitingConfirmation]: "warning",
  [INSTALLMENT_STATUS.confirmed]: "success",
  [INSTALLMENT_STATUS.disputed]: "danger",
  [INSTALLMENT_STATUS.paid]: "success",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  [CONTRACT_STATUS.active]: "ativo",
  [CONTRACT_STATUS.completed]: "concluído",
  [CONTRACT_STATUS.cancelled]: "cancelado",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, Tone> = {
  [CONTRACT_STATUS.active]: "brand",
  [CONTRACT_STATUS.completed]: "success",
  [CONTRACT_STATUS.cancelled]: "neutral",
};

// Papéis: inclui rótulos exibidos que não são papéis de domínio puros (ex.: contraparte).
export const ROLE_LABEL: Record<string, string> = {
  [PARTICIPANT_ROLE.owner]: "dono",
  [PARTICIPANT_ROLE.buyer]: "comprador",
  [PARTICIPANT_ROLE.seller]: "vendedor",
  [PARTICIPANT_ROLE.viewer]: "convidado",
  neutral: "neutro",
  counterparty: "contraparte",
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`

```bash
git add apps/web/src/lib/labels.ts
git commit -m "feat(web): lib/labels (labels pt-BR + tones em fonte única)"
```

---

## Task 4: Web — badges consomem `labels` + `shared`

**Files:**
- Modify: `apps/web/src/components/status-badge.tsx`
- Modify: `apps/web/src/components/contract-status-badge.tsx`

- [ ] **Step 1: `status-badge.tsx`** — remover `LABELS`/`TONES`/`PAID` locais; usar `INSTALLMENT_STATUS_LABEL`, `INSTALLMENT_STATUS_TONE` e `isPaidStatus`:

```tsx
import { isPaidStatus } from "@quitto/shared";
import { Badge } from "@/components/ui/badge";
import { INSTALLMENT_STATUS_LABEL, INSTALLMENT_STATUS_TONE } from "@/lib/labels";

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue && !isPaidStatus(status)) {
    return <Badge tone="danger">atrasada</Badge>;
  }
  const label = INSTALLMENT_STATUS_LABEL[status as keyof typeof INSTALLMENT_STATUS_LABEL] ?? status;
  const tone = INSTALLMENT_STATUS_TONE[status as keyof typeof INSTALLMENT_STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
```

- [ ] **Step 2: `contract-status-badge.tsx`** — remover maps locais; usar `CONTRACT_STATUS_LABEL`/`CONTRACT_STATUS_TONE`.

- [ ] **Step 3: Rodar testes dos badges**

Run: `bun --filter @quitto/web test status-badge`
Expected: PASS (comportamento idêntico).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/status-badge.tsx apps/web/src/components/contract-status-badge.tsx
git commit -m "refactor(web): badges usam labels/predicados centralizados"
```

---

## Task 5: Web — `contract-detail.tsx` sem lógica/maps locais

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`

- [ ] **Step 1: Remover `ROLE_LABELS`, `PAID_STATUSES`, `isOverdue` locais** e importar do shared/labels:

```tsx
import { isOverdue } from "@quitto/shared";
import { ROLE_LABEL } from "@/lib/labels";
```

Trocar usos: `ROLE_LABELS[x]` → `ROLE_LABEL[x] ?? x`; remover a função local `isOverdue` e usar a do shared (passando `new Date().toISOString().slice(0,10)` como `todayISO` — ou um pequeno helper `todayISO()` em `lib/format`).

- [ ] **Step 2: (opcional, recomendado) `todayISO()` em `lib/format.ts`** para não repetir o slice:

```ts
/** Today's date as ISO (YYYY-MM-DD), local time. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Rodar testes do detail**

Run: `bun --filter @quitto/web test contract-detail`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/contract-detail.tsx apps/web/src/lib/format.ts
git commit -m "refactor(web): contract-detail usa isOverdue/labels centralizados"
```

---

## Task 6: Web — `installment-actions.ts` e `contract-new.tsx` sem literais

**Files:**
- Modify: `apps/web/src/lib/installment-actions.ts`
- Modify: `apps/web/src/routes/contract-new.tsx`

- [ ] **Step 1: `installment-actions.ts`** — usar `INSTALLMENT_STATUS` e `PARTICIPANT_ROLE`:

```ts
import { INSTALLMENT_STATUS, PARTICIPANT_ROLE } from "@quitto/shared";
```
Trocar `role === "owner" || role === "buyer"` → `role === PARTICIPANT_ROLE.owner || role === PARTICIPANT_ROLE.buyer`; status idem com `INSTALLMENT_STATUS.*`.

- [ ] **Step 2: `contract-new.tsx`** — as opções de "Meu papel" derivam de `OWNER_ROLE` + `ROLE_LABEL`:

```tsx
import { OWNER_ROLE } from "@quitto/shared";
import { ROLE_LABEL } from "@/lib/labels";
```
```tsx
          {Object.values(OWNER_ROLE).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
```
E o `defaultValues.ownerRole` → `OWNER_ROLE.buyer`.

- [ ] **Step 3: Rodar testes**

Run: `bun --filter @quitto/web test contract-new installment`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/installment-actions.ts apps/web/src/routes/contract-new.tsx
git commit -m "refactor(web): installment-actions e wizard sem literais de domínio"
```

---

## Task 7: Web — `installment-drawer.tsx`: extrair lógica + alinhar CurrencyField

**Files:**
- Create: `apps/web/src/lib/installment-form.ts`
- Modify: `apps/web/src/components/installment-drawer.tsx`
- Test: `apps/web/tests/installment-form.test.ts`

- [ ] **Step 1: Extrair `buildBody` para `lib/installment-form.ts` (com teste)**

Create `apps/web/src/lib/installment-form.ts`:

```ts
import type { UpdateInstallmentInput } from "@quitto/shared";

/** Builds a minimal PATCH body: only fields actually filled (so editing one doesn't clear the other). */
export function buildInstallmentPatch(values: UpdateInstallmentInput): UpdateInstallmentInput {
  const body: UpdateInstallmentInput = {};
  if (values.amountCents !== undefined && !Number.isNaN(values.amountCents)) {
    body.amountCents = values.amountCents;
  }
  if (values.dueDate) {
    body.dueDate = values.dueDate;
  }
  return body;
}
```

Test `apps/web/tests/installment-form.test.ts`:

```ts
import { buildInstallmentPatch } from "../src/lib/installment-form";

it("envia só os campos preenchidos", () => {
  expect(buildInstallmentPatch({ amountCents: 100 })).toEqual({ amountCents: 100 });
  expect(buildInstallmentPatch({ amountCents: Number.NaN, dueDate: "2026-01-01" })).toEqual({ dueDate: "2026-01-01" });
});
```

- [ ] **Step 2: No `installment-drawer.tsx`**: remover o `buildBody` local, importar `buildInstallmentPatch`; usar `INSTALLMENT_STATUS`/`PARTICIPANT_ROLE` nas comparações (`=== "owner"`, `=== "disputed"`); e **aplicar o `CurrencyField`** no `InstallmentEditForm` (em vez do input cru "Valor (centavos)"), label "Valor".

```tsx
import { CurrencyField } from "@/components/currency-field";
import { buildInstallmentPatch } from "@/lib/installment-form";
```
No form de edição, troque o bloco do amount por `CurrencyField` (dentro de um `FormProvider`/`Controller` — o `CurrencyField` usa `useFormContext`, então envolva o form de edição com `FormProvider {...form}`).

> **Nota:** se preferir não introduzir `FormProvider` aqui, mantenha o `CurrencyField` recebendo `control` explicitamente; o importante é não exibir centavos crus.

- [ ] **Step 3: Rodar testes (drawer + form)**

Run: `bun --filter @quitto/web test installment`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/installment-form.ts apps/web/src/components/installment-drawer.tsx apps/web/tests/installment-form.test.ts
git commit -m "refactor(web): extrai buildInstallmentPatch; drawer com CurrencyField e constantes"
```

---

## Task 8: Varredura final de literais + fechar

**Files:** (verificação)

- [ ] **Step 1: Varredura — não pode sobrar literal de domínio em comparação fora de `ui/`, `labels.ts`, `domain.ts`**

Run:
```bash
grep -rnoE '=== "(pending|awaiting_confirmation|confirmed|disputed|paid|buyer|seller|neutral|owner|viewer|active|completed|cancelled)"' apps/web/src --include='*.tsx' --include='*.ts' | grep -vE 'test'
```
Expected: **nenhum resultado** (todas as comparações via constante). Corrija o que aparecer.

- [ ] **Step 2: Suíte completa**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde (≈108+ testes).

- [ ] **Step 3: Eden ainda tipa**

Run: `bun --filter @quitto/web test eden`
Expected: PASS.

- [ ] **Step 4: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff refactor/frontend-clean-arch -m "Merge refactor/frontend-clean-arch em develop"
```

---

## Task 9: Codificar a regra (spec §9) — vale pras próximas fases

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-quitto-design.md`

- [ ] **Step 1: Adicionar à seção 9 (Qualidade) uma subseção "Arquitetura de frontend (obrigatória)"** com:
  - Componentes finos: lógica de negócio/derivação em hooks (`use-*`) ou utils puros (`lib/*`), não em `.tsx`.
  - **Sem valores mágicos:** conjuntos de domínio (status, papéis, tipos) vêm de constantes/enums em `@quitto/shared`; comparações sempre via constante nomeada.
  - DRY: utilitário reusável mora em `lib`, nunca local no componente.
  - Apresentação (labels pt-BR/tones) centralizada em `lib/labels.ts`.
  - Todo plano de fase futura inclui um checklist de clean-arch e roda a skill `react-clean-architecture` na parte de UI.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-09-quitto-design.md
git commit -m "docs: regra de arquitetura de frontend (clean-arch) no spec §9"
```

---

## Self-Review (cobertura)

- **Fonte única de constantes/enums (back+front):** Tasks 1, 2, 6 ✅
- **Fim das 3 cópias divergentes de pago/atrasado:** Tasks 1, 2, 5 ✅
- **Labels/tones centralizados:** Tasks 3, 4 ✅
- **Lógica fora da UI (buildBody → lib; isOverdue → shared):** Tasks 5, 7 ✅
- **Sem literais mágicos (varredura prova):** Task 8 ✅
- **Inconsistência do CurrencyField no drawer:** Task 7 ✅
- **Comportamento preservado (rede de testes verde):** todas as tasks ✅
- **Regra codificada pras próximas fases:** Task 9 ✅

> **Princípio:** refator é movimentação **sem mudança de comportamento** — se algum teste mudar de resultado, parar e investigar (pode ter achado um bug latente, como a divergência de "atrasada" — nesse caso, registrar no BUGS.md e decidir o comportamento correto explicitamente).
