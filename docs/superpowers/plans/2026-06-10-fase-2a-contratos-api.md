# Fase 2a — Contratos & Parcelas (API + domínio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend do core de contratos — modelar Contract/Installment/Participant, gerar cronograma de parcelas (com valores iguais e variáveis), RBAC por papel, e endpoints para criar, listar, detalhar contratos e editar uma parcela. Sem UI (Fase 2b).

**Architecture:** Lógica de domínio em **funções puras testáveis** (`lib/money`, `lib/dates`, `lib/schedule`, `lib/contract-progress`), separadas dos endpoints. Acesso ao banco via Drizzle. Endpoints seguem o padrão existente: módulo Elysia com `prefix: "/api"`, `requireAuth(request.headers)` dentro do handler (sem macro/derive, mantendo os tipos do Eden), validação/response em **TypeBox** (`t`). RBAC via helper `getContractRole(userId, contractId)`.

**Tech Stack:** Elysia 1.4 + TypeBox, Drizzle 0.45 (Postgres), Better Auth (sessão via `requireAuth`), `bun test`.

> **Convenção (spec §9):** código/rotas/identificadores/comentários em inglês; mensagens ao usuário em pt-BR.
> **Dinheiro:** sempre **inteiros em centavos** (`amountCents`) — nunca float. Formatação R$ é problema da UI (2b).
> **Validação:** o codebase padronizou **TypeBox** (`t`) para a API (não Zod) — seguimos o padrão existente; a validação Zod fica nos forms do front (2b).

> **Pré-requisitos:** Fase 1 em `develop`. Postgres local de pé. Crie a branch `feat/fase-2a-contratos-api` a partir de `develop`. Ao fim, com tudo verde, merge em `develop`.

---

## Estrutura de arquivos (novos/alterados)

```
apps/api/
├─ src/
│  ├─ db/schema.ts                  # + enums e tabelas contract/installment/participant
│  ├─ lib/
│  │  ├─ errors.ts                  # + NotFoundError, ForbiddenError, ValidationError
│  │  ├─ money.ts                   # splitAmount (novo)
│  │  ├─ dates.ts                   # addMonths (novo)
│  │  ├─ schedule.ts                # generateSchedule (novo)
│  │  ├─ contract-progress.ts       # computeProgress (novo)
│  │  └─ contract-access.ts         # getContractRole (novo)
│  ├─ modules/
│  │  └─ contracts.ts               # endpoints de contratos (novo)
│  └─ app.ts                        # + .use(contractsModule)
└─ tests/
   ├─ money.test.ts
   ├─ dates.test.ts
   ├─ schedule.test.ts
   ├─ contract-progress.test.ts
   ├─ contract-access.test.ts
   └─ contracts.test.ts
```

---

## Task 1: Schema do domínio (tabelas + enums) e migração

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Adicionar enums e tabelas ao fim de `apps/api/src/db/schema.ts`**

Acrescente os imports necessários no topo (mantenha os existentes) — garanta que `integer`, `date`, `pgEnum`, `uuid` estão importados de `drizzle-orm/pg-core`:

```ts
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
```

E adicione ao fim do arquivo:

```ts
export const ownerRoleEnum = pgEnum("owner_role", ["buyer", "seller", "neutral"]);
export const contractStatusEnum = pgEnum("contract_status", ["active", "completed", "cancelled"]);
export const installmentStatusEnum = pgEnum("installment_status", [
  "pending",
  "awaiting_confirmation",
  "confirmed",
  "disputed",
  "paid",
]);
export const participantRoleEnum = pgEnum("participant_role", ["owner", "buyer", "seller", "viewer"]);

export const contract = pgTable("contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  ownerRole: ownerRoleEnum("owner_role").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  installmentsCount: integer("installments_count").notNull(),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  status: contractStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const installment = pgTable("installment", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contract.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  status: installmentStatusEnum("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const participant = pgTable("participant", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contract.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: participantRoleEnum("role").notNull(),
  linkedUserId: text("linked_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Gerar a migração**

Run (na pasta `apps/api`, com envs): `bun run db:generate`
Expected: cria `apps/api/drizzle/0001_*.sql` com os enums e as 3 tabelas.

- [ ] **Step 3: Aplicar a migração**

Run: `bun run db:migrate`
Expected: "migrations applied"; tabelas criadas.

- [ ] **Step 4: Typecheck**

Run: `bun --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle
git commit -m "feat(api): schema de contract/installment/participant + migração"
```

---

## Task 2: `lib/money.ts` — split de valor em centavos (TDD)

**Files:**
- Create: `apps/api/src/lib/money.ts`
- Test: `apps/api/tests/money.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/api/tests/money.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { splitAmount } from "../src/lib/money";

describe("splitAmount", () => {
  it("splits evenly when divisible", () => {
    expect(splitAmount(12_000, 3)).toEqual([4000, 4000, 4000]);
  });

  it("distributes the remainder to the first installments", () => {
    // 10_000 / 3 = 3333 r1 -> [3334, 3333, 3333]
    expect(splitAmount(10_000, 3)).toEqual([3334, 3333, 3333]);
  });

  it("always sums back to the total", () => {
    const parts = splitAmount(120_000_00, 60);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(120_000_00);
    expect(parts).toHaveLength(60);
  });

  it("throws for non-positive count", () => {
    expect(() => splitAmount(1000, 0)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/money.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/api/src/lib/money.ts`**

```ts
/** Splits a total (in cents) into `count` parts; the remainder cents go to the first parts. */
export function splitAmount(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("count must be a positive integer");
  }
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/money.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/money.ts apps/api/tests/money.test.ts
git commit -m "feat(api): splitAmount (rateio de centavos sem perda)"
```

---

## Task 3: `lib/dates.ts` — somar meses com clamp de fim de mês (TDD)

**Files:**
- Create: `apps/api/src/lib/dates.ts`
- Test: `apps/api/tests/dates.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/api/tests/dates.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { addMonths, toISODate } from "../src/lib/dates";

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(toISODate(addMonths("2026-01-15", 1))).toBe("2026-02-15");
  });

  it("clamps the day to the end of a shorter month", () => {
    // Jan 31 + 1 month -> Feb 28 (2026 não é bissexto)
    expect(toISODate(addMonths("2026-01-31", 1))).toBe("2026-02-28");
  });

  it("rolls over the year", () => {
    expect(toISODate(addMonths("2026-12-10", 2))).toBe("2027-02-10");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/dates.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/api/src/lib/dates.ts`**

```ts
/** Parses an ISO date (YYYY-MM-DD) into year/month/day numbers (UTC-safe, no timezone drift). */
function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Adds `months` to an ISO date, clamping the day to the target month's last day. Returns ISO string. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseISODate(iso);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Identity helper kept for symmetry/readability in callers and tests. */
export function toISODate(iso: string): string {
  return iso;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/dates.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/dates.ts apps/api/tests/dates.test.ts
git commit -m "feat(api): addMonths com clamp de fim de mês"
```

---

## Task 4: `lib/schedule.ts` — gerar cronograma de parcelas (TDD)

**Files:**
- Create: `apps/api/src/lib/schedule.ts`
- Test: `apps/api/tests/schedule.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/api/tests/schedule.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { generateSchedule } from "../src/lib/schedule";

describe("generateSchedule", () => {
  it("creates N installments with monthly due dates and split amounts", () => {
    const rows = generateSchedule({
      totalAmountCents: 120_000_00,
      installmentsCount: 60,
      firstDueDate: "2026-07-10",
    });
    expect(rows).toHaveLength(60);
    expect(rows[0]).toEqual({ sequence: 1, amountCents: 200_000, dueDate: "2026-07-10" });
    expect(rows[1]?.dueDate).toBe("2026-08-10");
    expect(rows.reduce((a, r) => a + r.amountCents, 0)).toBe(120_000_00);
  });

  it("sequences start at 1 and increase by 1", () => {
    const rows = generateSchedule({
      totalAmountCents: 1000,
      installmentsCount: 2,
      firstDueDate: "2026-01-31",
    });
    expect(rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(rows[1]?.dueDate).toBe("2026-02-28");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/schedule.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/api/src/lib/schedule.ts`**

```ts
import { addMonths } from "./dates";
import { splitAmount } from "./money";

export interface ScheduleRow {
  sequence: number;
  amountCents: number;
  dueDate: string;
}

export interface GenerateScheduleInput {
  totalAmountCents: number;
  installmentsCount: number;
  firstDueDate: string;
}

/** Builds an equal-split monthly schedule. For variable amounts, callers pass rows directly (custom mode). */
export function generateSchedule(input: GenerateScheduleInput): ScheduleRow[] {
  const amounts = splitAmount(input.totalAmountCents, input.installmentsCount);
  return amounts.map((amountCents, i) => ({
    sequence: i + 1,
    amountCents,
    dueDate: addMonths(input.firstDueDate, i),
  }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/schedule.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/schedule.ts apps/api/tests/schedule.test.ts
git commit -m "feat(api): generateSchedule (cronograma mensal com rateio)"
```

---

## Task 5: `lib/contract-progress.ts` — progresso e atraso (TDD)

**Files:**
- Create: `apps/api/src/lib/contract-progress.ts`
- Test: `apps/api/tests/contract-progress.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/api/tests/contract-progress.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { computeProgress } from "../src/lib/contract-progress";

const rows = [
  { amountCents: 1000, dueDate: "2026-01-10", status: "paid" as const },
  { amountCents: 1000, dueDate: "2026-02-10", status: "confirmed" as const },
  { amountCents: 1000, dueDate: "2026-03-10", status: "pending" as const },
];

describe("computeProgress", () => {
  it("sums paid/confirmed as paid and computes remaining + percent", () => {
    const p = computeProgress(rows, "2026-02-15");
    expect(p.paidCents).toBe(2000);
    expect(p.totalCents).toBe(3000);
    expect(p.remainingCents).toBe(1000);
    expect(p.paidCount).toBe(2);
    expect(p.totalCount).toBe(3);
    expect(p.percent).toBe(67); // arredondado
  });

  it("flags overdue installments (pending and past due)", () => {
    const p = computeProgress(rows, "2026-03-20");
    expect(p.overdueCount).toBe(1);
  });

  it("does not flag overdue before the due date", () => {
    const p = computeProgress(rows, "2026-03-01");
    expect(p.overdueCount).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/contract-progress.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/api/src/lib/contract-progress.ts`**

```ts
type InstallmentLike = {
  amountCents: number;
  dueDate: string;
  status: "pending" | "awaiting_confirmation" | "confirmed" | "disputed" | "paid";
};

const PAID_STATUSES = new Set(["paid", "confirmed"]);

export interface ContractProgress {
  paidCents: number;
  totalCents: number;
  remainingCents: number;
  paidCount: number;
  totalCount: number;
  overdueCount: number;
  percent: number;
}

/** Computes contract progress and overdue count relative to `todayISO` (YYYY-MM-DD). */
export function computeProgress(items: InstallmentLike[], todayISO: string): ContractProgress {
  let paidCents = 0;
  let totalCents = 0;
  let paidCount = 0;
  let overdueCount = 0;

  for (const item of items) {
    totalCents += item.amountCents;
    const isPaid = PAID_STATUSES.has(item.status);
    if (isPaid) {
      paidCents += item.amountCents;
      paidCount += 1;
    }
    if (!isPaid && item.status !== "awaiting_confirmation" && item.dueDate < todayISO) {
      overdueCount += 1;
    }
  }

  return {
    paidCents,
    totalCents,
    remainingCents: totalCents - paidCents,
    paidCount,
    totalCount: items.length,
    overdueCount,
    percent: totalCents === 0 ? 0 : Math.round((paidCents / totalCents) * 100),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/contract-progress.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/contract-progress.ts apps/api/tests/contract-progress.test.ts
git commit -m "feat(api): computeProgress (progresso + atraso derivado)"
```

---

## Task 6: Erros de domínio (`NotFoundError`, `ForbiddenError`, `ValidationError`)

**Files:**
- Modify: `apps/api/src/lib/errors.ts`

- [ ] **Step 1: Adicionar as subclasses em `apps/api/src/lib/errors.ts`** (após `UnauthorizedError`)

```ts
export class NotFoundError extends AppError {
  constructor(message = "Não encontrado") {
    super({ code: "NOT_FOUND", httpStatus: 404, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Sem permissão") {
    super({ code: "FORBIDDEN", httpStatus: 403, message });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details?: Record<string, unknown>) {
    super({ code: "VALIDATION", httpStatus: 422, message, details });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/errors.ts
git commit -m "feat(api): erros de domínio (NotFound/Forbidden/Validation)"
```

---

## Task 7: `lib/contract-access.ts` — RBAC por contrato (TDD com banco)

**Files:**
- Create: `apps/api/src/lib/contract-access.ts`
- Test: `apps/api/tests/contract-access.test.ts`

- [ ] **Step 1: Implementar `apps/api/src/lib/contract-access.ts`**

```ts
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant } from "../db/schema";
import { NotFoundError } from "./errors";

export type ContractRole = "owner" | "buyer" | "seller" | "viewer";

/**
 * Resolves the user's role on a contract. Throws NotFoundError when the contract does not exist
 * OR the user has no access (não vaza existência). Owner is derived from contract.ownerId.
 */
export async function getContractRole(userId: string, contractId: string): Promise<ContractRole> {
  const found = await db.select().from(contract).where(eq(contract.id, contractId)).limit(1);
  const row = found[0];
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
  if (row.ownerId === userId) {
    return "owner";
  }
  const link = await db
    .select()
    .from(participant)
    .where(and(eq(participant.contractId, contractId), eq(participant.linkedUserId, userId)))
    .limit(1);
  const role = link[0]?.role;
  if (!role || role === "owner") {
    throw new NotFoundError("Contrato não encontrado");
  }
  return role;
}
```

- [ ] **Step 2: Escrever o teste (usa banco + cria usuário/contrato direto)**

Create `apps/api/tests/contract-access.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { db } from "../src/db/client";
import { contract, user } from "../src/db/schema";
import { getContractRole } from "../src/lib/contract-access";

async function makeUser(id: string) {
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .onConflictDoNothing();
}

describe("getContractRole", () => {
  it("returns 'owner' for the contract owner", async () => {
    const uid = `owner-${Date.now()}`;
    await makeUser(uid);
    const [c] = await db
      .insert(contract)
      .values({
        ownerId: uid,
        title: "T",
        ownerRole: "buyer",
        totalAmountCents: 1000,
        installmentsCount: 1,
      })
      .returning();
    expect(await getContractRole(uid, c!.id)).toBe("owner");
  });

  it("throws NotFound for a stranger (não vaza existência)", async () => {
    const owner = `o2-${Date.now()}`;
    const stranger = `s2-${Date.now()}`;
    await makeUser(owner);
    await makeUser(stranger);
    const [c] = await db
      .insert(contract)
      .values({
        ownerId: owner,
        title: "T",
        ownerRole: "seller",
        totalAmountCents: 1000,
        installmentsCount: 1,
      })
      .returning();
    await expect(getContractRole(stranger, c!.id)).rejects.toThrow(/não encontrado/i);
  });
});
```

- [ ] **Step 3: Rodar e ver passar**

Run (com Postgres + envs): `bun --filter @quitto/api test tests/contract-access.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/contract-access.ts apps/api/tests/contract-access.test.ts
git commit -m "feat(api): getContractRole (RBAC por contrato, 404 sem vazar)"
```

---

## Task 8: `POST /api/contracts` — criar contrato + cronograma + participante owner

**Files:**
- Create: `apps/api/src/modules/contracts.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/contracts.test.ts`

- [ ] **Step 1: Criar `apps/api/src/modules/contracts.ts` com o POST**

```ts
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { generateSchedule } from "../lib/schedule";
import { requireAuth } from "../lib/session";

const ScheduleAuto = t.Object({
  mode: t.Literal("auto"),
  totalAmountCents: t.Integer({ minimum: 1 }),
  installmentsCount: t.Integer({ minimum: 1, maximum: 600 }),
  firstDueDate: t.String({ format: "date" }),
});

const ScheduleCustom = t.Object({
  mode: t.Literal("custom"),
  installments: t.Array(
    t.Object({ amountCents: t.Integer({ minimum: 1 }), dueDate: t.String({ format: "date" }) }),
    { minItems: 1, maxItems: 600 },
  ),
});

const CreateContractBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  ownerRole: t.Union([t.Literal("buyer"), t.Literal("seller"), t.Literal("neutral")]),
  requiresConfirmation: t.Boolean(),
  schedule: t.Union([ScheduleAuto, ScheduleCustom]),
});

export const contractsModule = new Elysia({ prefix: "/api" }).post(
  "/contracts",
  async ({ request, body }) => {
    const { user } = await requireAuth(request.headers);

    const rows =
      body.schedule.mode === "auto"
        ? generateSchedule({
            totalAmountCents: body.schedule.totalAmountCents,
            installmentsCount: body.schedule.installmentsCount,
            firstDueDate: body.schedule.firstDueDate,
          })
        : body.schedule.installments.map((it, i) => ({
            sequence: i + 1,
            amountCents: it.amountCents,
            dueDate: it.dueDate,
          }));

    const totalAmountCents = rows.reduce((acc, r) => acc + r.amountCents, 0);

    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(contract)
        .values({
          ownerId: user.id,
          title: body.title,
          description: body.description ?? null,
          ownerRole: body.ownerRole,
          totalAmountCents,
          installmentsCount: rows.length,
          requiresConfirmation: body.requiresConfirmation,
        })
        .returning({ id: contract.id });

      const contractId = created!.id;

      await tx.insert(installment).values(
        rows.map((r) => ({
          contractId,
          sequence: r.sequence,
          amountCents: r.amountCents,
          dueDate: r.dueDate,
        })),
      );

      await tx.insert(participant).values({
        contractId,
        displayName: user.name,
        role: "owner",
        linkedUserId: user.id,
      });

      return contractId;
    });

    return { id };
  },
  {
    body: CreateContractBody,
    response: t.Object({ id: t.String() }),
  },
);
```

- [ ] **Step 2: Registrar o módulo em `apps/api/src/app.ts`**

Adicione o import e o `.use`:

```ts
import { contractsModule } from "./modules/contracts";
```

No `buildApp`, após `.use(meModule)`:

```ts
    .use(meModule)
    .use(contractsModule);
```

- [ ] **Step 3: Escrever o teste de criação**

Create `apps/api/tests/contracts.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        email: `${tag}-${Date.now()}@example.com`,
        password: "password123",
      }),
    }),
  );
  return (res.headers.get("set-cookie") as string).split(";")[0] as string;
}

async function createContract(cookie: string) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Apê do irmão",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: { mode: "auto", totalAmountCents: 120_000_00, installmentsCount: 60, firstDueDate: "2026-07-10" },
      }),
    }),
  );
}

describe("POST /api/contracts", () => {
  it("requer autenticação", async () => {
    const res = await createContract("");
    expect(res.status).toBe(401);
  });

  it("cria contrato e retorna id", async () => {
    const cookie = await signUpCookie("create");
    const res = await createContract(cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
  });
});
```

- [ ] **Step 4: Rodar e ver passar**

Run (com Postgres + envs): `bun --filter @quitto/api test tests/contracts.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/contracts.ts apps/api/src/app.ts apps/api/tests/contracts.test.ts
git commit -m "feat(api): POST /api/contracts (cria contrato + cronograma + owner)"
```

---

## Task 9: `GET /api/contracts` — listar contratos do usuário com progresso

**Files:**
- Modify: `apps/api/src/modules/contracts.ts`
- Test: `apps/api/tests/contracts.test.ts`

- [ ] **Step 1: Adicionar o handler de listagem em `contracts.ts`** (encadeie `.get` após o `.post`)

No topo do arquivo, adicione os imports:

```ts
import { inArray, or, eq } from "drizzle-orm";
import { contract, installment, participant } from "../db/schema";
import { computeProgress } from "../lib/contract-progress";
```

(Combine com os imports já existentes do mesmo módulo — não duplique.)

Encadeie no `contractsModule`, após o `.post(...)`:

```ts
  .get(
    "/contracts",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);

      const linked = await db
        .select({ contractId: participant.contractId })
        .from(participant)
        .where(eq(participant.linkedUserId, user.id));
      const linkedIds = linked.map((l) => l.contractId);

      const rows = await db
        .select()
        .from(contract)
        .where(
          linkedIds.length > 0
            ? or(eq(contract.ownerId, user.id), inArray(contract.id, linkedIds))
            : eq(contract.ownerId, user.id),
        );

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const items = await db.select().from(installment).where(inArray(installment.contractId, ids));
      const today = new Date().toISOString().slice(0, 10);

      return rows.map((c) => {
        const own = items.filter((it) => it.contractId === c.id);
        const progress = computeProgress(own, today);
        return {
          id: c.id,
          title: c.title,
          ownerRole: c.ownerRole,
          status: c.status,
          totalCents: progress.totalCents,
          paidCents: progress.paidCents,
          percent: progress.percent,
          overdueCount: progress.overdueCount,
          installmentsCount: c.installmentsCount,
        };
      });
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          ownerRole: t.String(),
          status: t.String(),
          totalCents: t.Integer(),
          paidCents: t.Integer(),
          percent: t.Integer(),
          overdueCount: t.Integer(),
          installmentsCount: t.Integer(),
        }),
      ),
    },
  )
```

> **Nota:** `new Date().toISOString()` é permitido no runtime do app (só os *scripts de workflow* proíbem `Date.now()`; o código de produção pode usar datas).

- [ ] **Step 2: Adicionar o teste de listagem em `contracts.test.ts`**

Acrescente ao `describe` (ou um novo `describe`):

```ts
describe("GET /api/contracts", () => {
  it("lista apenas os contratos do usuário com progresso", async () => {
    const cookie = await signUpCookie("list");
    await createContract(cookie);
    const res = await app.handle(
      new Request("http://localhost/api/contracts", { headers: { cookie } }),
    );
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty("percent");
    expect(list[0].totalCents).toBe(120_000_00);
  });
});
```

- [ ] **Step 3: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/contracts.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/contracts.ts apps/api/tests/contracts.test.ts
git commit -m "feat(api): GET /api/contracts (lista do usuário com progresso)"
```

---

## Task 10: `GET /api/contracts/:id` — detalhe (contrato + parcelas + participantes)

**Files:**
- Modify: `apps/api/src/modules/contracts.ts`
- Test: `apps/api/tests/contracts.test.ts`

- [ ] **Step 1: Adicionar o handler de detalhe** (encadeie `.get` após a listagem)

No topo, adicione o import do RBAC:

```ts
import { getContractRole } from "../lib/contract-access";
```

Encadeie:

```ts
  .get(
    "/contracts/:id",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const role = await getContractRole(user.id, params.id); // lança 404 se sem acesso

      const [c] = await db.select().from(contract).where(eq(contract.id, params.id)).limit(1);
      const items = await db
        .select()
        .from(installment)
        .where(eq(installment.contractId, params.id));
      const people = await db
        .select()
        .from(participant)
        .where(eq(participant.contractId, params.id));
      const today = new Date().toISOString().slice(0, 10);
      const progress = computeProgress(items, today);

      return {
        role,
        contract: {
          id: c!.id,
          title: c!.title,
          description: c!.description,
          ownerRole: c!.ownerRole,
          requiresConfirmation: c!.requiresConfirmation,
          status: c!.status,
        },
        progress: {
          totalCents: progress.totalCents,
          paidCents: progress.paidCents,
          remainingCents: progress.remainingCents,
          percent: progress.percent,
          overdueCount: progress.overdueCount,
        },
        installments: items
          .sort((a, b) => a.sequence - b.sequence)
          .map((it) => ({
            id: it.id,
            sequence: it.sequence,
            amountCents: it.amountCents,
            dueDate: it.dueDate,
            status: it.status,
          })),
        participants: people.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          linked: p.linkedUserId !== null,
        })),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({
        role: t.String(),
        contract: t.Object({
          id: t.String(),
          title: t.String(),
          description: t.Union([t.String(), t.Null()]),
          ownerRole: t.String(),
          requiresConfirmation: t.Boolean(),
          status: t.String(),
        }),
        progress: t.Object({
          totalCents: t.Integer(),
          paidCents: t.Integer(),
          remainingCents: t.Integer(),
          percent: t.Integer(),
          overdueCount: t.Integer(),
        }),
        installments: t.Array(
          t.Object({
            id: t.String(),
            sequence: t.Integer(),
            amountCents: t.Integer(),
            dueDate: t.String(),
            status: t.String(),
          }),
        ),
        participants: t.Array(
          t.Object({
            id: t.String(),
            displayName: t.String(),
            role: t.String(),
            linked: t.Boolean(),
          }),
        ),
      }),
    },
  )
```

- [ ] **Step 2: Adicionar testes de detalhe (acesso ok e estranho 404)**

```ts
describe("GET /api/contracts/:id", () => {
  it("retorna o detalhe para o dono", async () => {
    const cookie = await signUpCookie("detail");
    const created = await (await createContract(cookie)).json();
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}`, { headers: { cookie } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(body.installments).toHaveLength(60);
  });

  it("retorna 404 para quem não tem acesso", async () => {
    const ownerCookie = await signUpCookie("own");
    const created = await (await createContract(ownerCookie)).json();
    const strangerCookie = await signUpCookie("stranger");
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}`, {
        headers: { cookie: strangerCookie },
      }),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/contracts.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/contracts.ts apps/api/tests/contracts.test.ts
git commit -m "feat(api): GET /api/contracts/:id (detalhe com RBAC)"
```

---

## Task 11: `PATCH /api/contracts/:id/installments/:installmentId` — editar valor/vencimento (owner)

**Files:**
- Modify: `apps/api/src/modules/contracts.ts`
- Test: `apps/api/tests/contracts.test.ts`

- [ ] **Step 1: Adicionar o handler PATCH** (encadeie após o detalhe)

Adicione os imports necessários no topo (combine com os existentes):

```ts
import { and } from "drizzle-orm";
import { ForbiddenError } from "../lib/errors";
```

Encadeie:

```ts
  .patch(
    "/contracts/:id/installments/:installmentId",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const role = await getContractRole(user.id, params.id);
      if (role !== "owner") {
        throw new ForbiddenError("Apenas o dono edita parcelas");
      }

      const [updated] = await db
        .update(installment)
        .set({
          ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
          ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
        })
        .where(
          and(eq(installment.id, params.installmentId), eq(installment.contractId, params.id)),
        )
        .returning({ id: installment.id });

      if (!updated) {
        throw new ForbiddenError("Parcela não pertence ao contrato");
      }
      return { id: updated.id };
    },
    {
      params: t.Object({ id: t.String(), installmentId: t.String() }),
      body: t.Object({
        amountCents: t.Optional(t.Integer({ minimum: 1 })),
        dueDate: t.Optional(t.String({ format: "date" })),
      }),
      response: t.Object({ id: t.String() }),
    },
  )
```

- [ ] **Step 2: Adicionar teste do PATCH**

```ts
describe("PATCH installment", () => {
  it("o dono edita o valor de uma parcela", async () => {
    const cookie = await signUpCookie("patch");
    const created = await (await createContract(cookie)).json();
    const detail = await (
      await app.handle(
        new Request(`http://localhost/api/contracts/${created.id}`, { headers: { cookie } }),
      )
    ).json();
    const first = detail.installments[0];
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}/installments/${first.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ amountCents: 999_99 }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/contracts.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/contracts.ts apps/api/tests/contracts.test.ts
git commit -m "feat(api): PATCH parcela (editar valor/vencimento, owner)"
```

---

## Task 12: Fechar a fase — suite completa, Eden e merge

**Files:** (verificação)

- [ ] **Step 1: Suite + typecheck + lint + build (monorepo)**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 2: Confirmar que o Eden ainda tipa (spike)**

Run: `bun --filter @quitto/web test`
Expected: PASS — os novos endpoints aparecem tipados no client (`api.api.contracts...`).

- [ ] **Step 3: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff feat/fase-2a-contratos-api -m "Merge da Fase 2a (contratos/parcelas API) em develop"
```

- [ ] **Step 4: Atualizar o ROADMAP**

Marque a Fase 2a como concluída (e ajuste a linha da Fase 2 para refletir o split 2a/2b), depois:

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca a Fase 2a (API de contratos) como concluída"
```

---

## Self-Review (cobertura)

- **Modelo de domínio (Contract/Installment/Participant):** Task 1 ✅
- **Gerar cronograma + valores iguais:** Tasks 2, 4 ✅
- **Valores variáveis:** suportado no create (`schedule.mode: "custom"`) e no PATCH — Tasks 8, 11 ✅
- **Datas mensais com clamp:** Task 3 ✅
- **Progresso + atraso derivado:** Task 5 ✅
- **RBAC por papel (404 sem vazar):** Tasks 7, 10, 11 ✅
- **Criar contrato (solo) + owner como participante:** Task 8 ✅
- **Listar contratos do usuário:** Task 9 ✅
- **Detalhar contrato (parcelas + participantes):** Task 10 ✅
- **Dinheiro em centavos (sem float):** aplicado em todo o plano ✅
- **Padrões existentes (módulo Elysia + requireAuth + TypeBox):** seguidos ✅
- **Fora de escopo (2b):** UI (lista, wizard, tela de contrato + drawer); fluxo de pagamento/comprovantes (Fase 3); convites/contatos com vínculo (Fase 4).

> **Observação de tipo:** os endpoints usam `t.String()` para enums no `response` (ex.: `status`, `role`) por simplicidade — o Eden os tipa como `string`. Se a 2b quiser unions estritas no front, dá pra trocar por `t.Union([t.Literal(...)])` depois; não é necessário agora.
