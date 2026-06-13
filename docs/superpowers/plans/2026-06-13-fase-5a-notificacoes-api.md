# Fase 5a — Notificações + lembretes (API + cron) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notificações in-app persistidas — geradas por eventos de pagamento e por um sweep diário de lembretes — expostas por endpoints escopados ao usuário. Sem UI (vem na 5b).

**Architecture:** Tabela `notification` com `dedupeKey` único para idempotência dos lembretes. Os destinatários derivam de resolvers **puros** (`resolvePayerUserIds`/`resolveApproverUserIds`) que reusam a lógica de vagas da 4c. Gatilhos acoplados às transações existentes em `payments.ts` (ao lado de `recordEvent`). O sweep é uma função pura `computeReminders` invocada por um entrypoint CLI que a Fly scheduled Machine roda 1×/dia.

**Tech Stack:** Bun + Elysia + Drizzle/Postgres, `bun test`, `@quitto/shared` (consts + zod), drizzle-kit (migrations).

**Spec:** `docs/superpowers/specs/2026-06-13-fase-5-notificacoes-design.md`

**Git:** branch `feat/fase-5a-notificacoes-api` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 5a no ROADMAP.

**Pré-requisitos de ambiente:** Postgres acessível (`DATABASE_URL`) para gerar/aplicar migration e rodar os testes de integração. (Os testes de payments também exigem MinIO/envs S3, mas as novas tarefas aqui não dependem de storage.)

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/domain.ts` (modificar) | `NOTIFICATION_TYPE` + tipo + `NOTIFICATION_TYPES`; `REMINDER_WINDOW_DAYS` |
| `packages/shared/src/index.ts` (modificar) | reexportar os novos símbolos |
| `apps/api/src/db/schema.ts` (modificar) | tabela `notification` |
| `apps/api/src/lib/dates.ts` (modificar) | `addDays` (helper UTC-safe) |
| `apps/api/src/lib/reminders.ts` (criar) | `computeReminders` (puro: data → lembretes) |
| `apps/api/src/lib/notifications.ts` (criar) | resolvers puros + `createNotifications` (tx) + `recipientsFor` |
| `apps/api/src/modules/payments.ts` (modificar) | disparar notificações ao lado de cada `recordEvent` |
| `apps/api/src/modules/notifications.ts` (criar) | endpoints list/unread-count/read/read-all |
| `apps/api/src/app.ts` (modificar) | registrar `notificationsModule` |
| `apps/api/src/cron/reminders.ts` (criar) | entrypoint: carrega dados → `computeReminders` → persiste |
| `apps/api/package.json` (modificar) | script `cron:reminders` |
| `apps/api/tests/reminders.test.ts` (criar) | unit do `computeReminders` |
| `apps/api/tests/notifications-resolvers.test.ts` (criar) | unit dos resolvers puros |
| `apps/api/tests/notifications.test.ts` (criar) | integração: gatilhos + endpoints + cron idempotente |

---

## Task 1: Constantes de domínio no `@quitto/shared`

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Adicionar as constantes em `domain.ts`**

Logo após o bloco `AUDIT_TYPE` (e antes de `PAID_STATUSES`), adicione:

```ts
export const NOTIFICATION_TYPE = {
  proofSubmitted: "proof_submitted",
  paymentConfirmed: "payment_confirmed",
  paymentDisputed: "payment_disputed",
  installmentPaid: "installment_paid",
  installmentDueSoon: "installment_due_soon",
  installmentOverdue: "installment_overdue",
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
export const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE) as [
  NotificationType,
  ...NotificationType[],
];

/** Quantos dias antes do vencimento o lembrete "due_soon" dispara. */
export const REMINDER_WINDOW_DAYS = 3;
```

- [ ] **Step 2: Reexportar em `index.ts`**

No bloco de `export type { ... }` adicione `NotificationType`. No bloco `export { ... }` (o que tem o `biome-ignore noBarrelFile`) adicione `NOTIFICATION_TYPE`, `NOTIFICATION_TYPES` e `REMINDER_WINDOW_DAYS`, mantendo a ordem alfabética aproximada já usada.

- [ ] **Step 3: Verificar typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/shared typecheck`
Expected: PASS (sem erros do tsc).

- [ ] **Step 4: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add packages/shared/src/domain.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipos de notificação + janela de lembrete"
```

---

## Task 2: Tabela `notification` + migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Declarar a tabela**

No fim de `schema.ts` (após `invite`), adicione. Use os imports já presentes no arquivo (`pgTable`, `uuid`, `text`, `jsonb`, `timestamp`, `index`, `unique` — adicione `unique` à lista de imports do `drizzle-orm/pg-core` no topo se ainda não estiver lá):

```ts
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installment.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    unique("notification_dedupe_key_key").on(table.dedupeKey),
  ]
);
```

- [ ] **Step 2: Gerar a migration**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun run db:generate`
Expected: cria um arquivo novo em `apps/api/drizzle/0008_*.sql` com `CREATE TABLE "notification" ...` e o índice/unique. Confira o conteúdo do arquivo gerado.

- [ ] **Step 3: Aplicar a migration**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun run db:migrate`
Expected: aplica sem erro ("migrations applied" / sem exceção).

- [ ] **Step 4: Verificar typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): tabela notification (dedupeKey único)"
```

---

## Task 3: Helper `addDays`

**Files:**
- Modify: `apps/api/src/lib/dates.ts`
- Test: `apps/api/tests/dates.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/api/tests/dates.test.ts`, adicione (mantendo o import existente — inclua `addDays` nele):

```ts
describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-07-10", 3)).toBe("2026-07-13");
  });
  it("rolls over month boundaries", () => {
    expect(addDays("2026-07-30", 3)).toBe("2026-08-02");
  });
  it("supports negative offsets", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dates.test.ts`
Expected: FAIL ("addDays is not a function" / não exportado).

- [ ] **Step 3: Implementar**

Em `apps/api/src/lib/dates.ts`, adicione:

```ts
/** Adds `days` to an ISO date (YYYY-MM-DD), UTC-safe. Returns ISO string. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/dates.ts apps/api/tests/dates.test.ts
git commit -m "feat(api): addDays UTC-safe"
```

---

## Task 4: Sweep puro `computeReminders`

**Files:**
- Create: `apps/api/src/lib/reminders.ts`
- Test: `apps/api/tests/reminders.test.ts`

Comparação de datas usa ordenação lexicográfica de strings `YYYY-MM-DD` (válida por serem zero-padded). A janela é `[hoje, hoje + REMINDER_WINDOW_DAYS]`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/tests/reminders.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { computeReminders } from "../src/lib/reminders";

const base = (over: Partial<Parameters<typeof computeReminders>[0][number]>) => ({
  installmentId: "i1",
  contractId: "c1",
  dueDate: "2026-07-10",
  payerUserId: "u1",
  ...over,
});

describe("computeReminders (today=2026-07-10)", () => {
  const today = "2026-07-10";

  it("flags due today as due_soon", () => {
    const out = computeReminders([base({ dueDate: "2026-07-10" })], today);
    expect(out).toEqual([
      {
        userId: "u1",
        contractId: "c1",
        installmentId: "i1",
        type: "installment_due_soon",
        dedupeKey: "reminder:installment_due_soon:i1",
      },
    ]);
  });

  it("flags due within the window (3 days) as due_soon", () => {
    const out = computeReminders([base({ dueDate: "2026-07-13" })], today);
    expect(out[0]?.type).toBe("installment_due_soon");
  });

  it("ignores due beyond the window", () => {
    const out = computeReminders([base({ dueDate: "2026-07-14" })], today);
    expect(out).toEqual([]);
  });

  it("flags past due as overdue", () => {
    const out = computeReminders([base({ dueDate: "2026-07-09" })], today);
    expect(out[0]?.type).toBe("installment_overdue");
    expect(out[0]?.dedupeKey).toBe("reminder:installment_overdue:i1");
  });

  it("skips installments without a linked payer", () => {
    const out = computeReminders([base({ payerUserId: null })], today);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/reminders.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/reminders").

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/reminders.ts`:

```ts
import {
  NOTIFICATION_TYPE,
  REMINDER_WINDOW_DAYS,
} from "@quitto/shared";
import { addDays } from "./dates";

export interface ReminderInput {
  installmentId: string;
  contractId: string;
  dueDate: string; // YYYY-MM-DD
  payerUserId: string | null;
}

export interface ReminderNotification {
  userId: string;
  contractId: string;
  installmentId: string;
  type:
    | typeof NOTIFICATION_TYPE.installmentDueSoon
    | typeof NOTIFICATION_TYPE.installmentOverdue;
  dedupeKey: string;
}

/**
 * Pure: maps open installments to the reminder notifications to create today.
 * `due_soon` for [today, today+REMINDER_WINDOW_DAYS]; `overdue` for past due.
 * Installments without a linked payer are skipped (no one to notify).
 */
export function computeReminders(
  items: ReminderInput[],
  todayISO: string
): ReminderNotification[] {
  const windowEnd = addDays(todayISO, REMINDER_WINDOW_DAYS);
  const out: ReminderNotification[] = [];
  for (const it of items) {
    if (!it.payerUserId) {
      continue;
    }
    let type: ReminderNotification["type"] | null = null;
    if (it.dueDate < todayISO) {
      type = NOTIFICATION_TYPE.installmentOverdue;
    } else if (it.dueDate <= windowEnd) {
      type = NOTIFICATION_TYPE.installmentDueSoon;
    }
    if (!type) {
      continue;
    }
    out.push({
      userId: it.payerUserId,
      contractId: it.contractId,
      installmentId: it.installmentId,
      type,
      dedupeKey: `reminder:${type}:${it.installmentId}`,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/reminders.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/reminders.ts apps/api/tests/reminders.test.ts
git commit -m "feat(api): computeReminders puro (janela + atraso + dedupeKey)"
```

---

## Task 5: Resolvers de destinatário + helper de criação

**Files:**
- Create: `apps/api/src/lib/notifications.ts`
- Test: `apps/api/tests/notifications-resolvers.test.ts`

Os resolvers são **puros** (recebem a lista de participantes, não tocam no banco) e espelham a regra da 4c: o dono herda o lado oposto **só** se não houver contraparte vinculada naquele lado.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/tests/notifications-resolvers.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  resolveApproverUserIds,
  resolvePayerUserIds,
} from "../src/lib/notifications";

const OWNER = "owner-1";

describe("resolvePayerUserIds", () => {
  it("returns linked buyers", () => {
    const set = resolvePayerUserIds(
      [{ role: "buyer", linkedUserId: "buyer-1" }],
      OWNER
    );
    expect([...set]).toEqual(["buyer-1"]);
  });

  it("owner (seller slot) inherits payer when no linked buyer", () => {
    const set = resolvePayerUserIds(
      [
        { role: "seller", linkedUserId: OWNER },
        { role: "buyer", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([OWNER]);
  });

  it("owner does NOT inherit payer once a buyer is linked", () => {
    const set = resolvePayerUserIds(
      [
        { role: "seller", linkedUserId: OWNER },
        { role: "buyer", linkedUserId: "buyer-1" },
      ],
      OWNER
    );
    expect([...set]).toEqual(["buyer-1"]);
  });
});

describe("resolveApproverUserIds", () => {
  it("returns linked sellers", () => {
    const set = resolveApproverUserIds(
      [{ role: "seller", linkedUserId: "seller-1" }],
      OWNER
    );
    expect([...set]).toEqual(["seller-1"]);
  });

  it("owner (buyer slot) inherits approver when no linked seller", () => {
    const set = resolveApproverUserIds(
      [
        { role: "buyer", linkedUserId: OWNER },
        { role: "seller", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([OWNER]);
  });

  it("ignores unlinked and viewer participants", () => {
    const set = resolveApproverUserIds(
      [
        { role: "viewer", linkedUserId: "v-1" },
        { role: "seller", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications-resolvers.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/notifications").

- [ ] **Step 3: Implementar `notifications.ts`**

Crie `apps/api/src/lib/notifications.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { db } from "../db/client";
import { contract, notification, participant } from "../db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

interface ParticipantLike {
  role: string;
  linkedUserId: string | null;
}

/** Linked user ids that can PAY (buyer slot, or owner inheriting when no linked buyer). */
export function resolvePayerUserIds(
  people: ParticipantLike[],
  ownerId: string
): Set<string> {
  const hasLinkedBuyer = people.some(
    (p) => p.role === "buyer" && p.linkedUserId !== null
  );
  const out = new Set<string>();
  for (const p of people) {
    if (!p.linkedUserId) {
      continue;
    }
    if (p.role === "buyer") {
      out.add(p.linkedUserId);
    }
    if (p.linkedUserId === ownerId && !hasLinkedBuyer) {
      out.add(p.linkedUserId);
    }
  }
  return out;
}

/** Linked user ids that can APPROVE (seller slot, or owner inheriting when no linked seller). */
export function resolveApproverUserIds(
  people: ParticipantLike[],
  ownerId: string
): Set<string> {
  const hasLinkedSeller = people.some(
    (p) => p.role === "seller" && p.linkedUserId !== null
  );
  const out = new Set<string>();
  for (const p of people) {
    if (!p.linkedUserId) {
      continue;
    }
    if (p.role === "seller") {
      out.add(p.linkedUserId);
    }
    if (p.linkedUserId === ownerId && !hasLinkedSeller) {
      out.add(p.linkedUserId);
    }
  }
  return out;
}

export type RecipientTarget = "payer" | "approver";

export interface NotificationInput {
  userId: string;
  type: string;
  contractId: string;
  installmentId?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
}

/**
 * Resolves the linked user ids of `target` for a contract, EXCLUDING the actor.
 * Reads contract owner + participants; reuses the pure resolvers above.
 */
export async function recipientsFor(
  exec: Exec,
  contractId: string,
  target: RecipientTarget,
  actorUserId: string
): Promise<string[]> {
  const [c] = await exec
    .select({ ownerId: contract.ownerId })
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!c) {
    return [];
  }
  const people = await exec
    .select({ role: participant.role, linkedUserId: participant.linkedUserId })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  const set =
    target === "payer"
      ? resolvePayerUserIds(people, c.ownerId)
      : resolveApproverUserIds(people, c.ownerId);
  set.delete(actorUserId);
  return [...set];
}

/**
 * Inserts notifications in bulk, joining an existing tx. `onConflictDoNothing`
 * makes reminder dedupeKeys idempotent (event rows leave dedupeKey null).
 */
export async function createNotifications(
  exec: Exec,
  inputs: NotificationInput[]
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }
  await exec
    .insert(notification)
    .values(
      inputs.map((i) => ({
        userId: i.userId,
        type: i.type,
        contractId: i.contractId,
        installmentId: i.installmentId ?? null,
        metadata: i.metadata ?? null,
        dedupeKey: i.dedupeKey ?? null,
      }))
    )
    .onConflictDoNothing();
}

/** Convenience: resolve recipients for a target and build event notifications. */
export async function notifyTarget(
  exec: Exec,
  args: {
    contractId: string;
    installmentId: string;
    actorUserId: string;
    target: RecipientTarget;
    type: string;
    metadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  const userIds = await recipientsFor(
    exec,
    args.contractId,
    args.target,
    args.actorUserId
  );
  await createNotifications(
    exec,
    userIds.map((userId) => ({
      userId,
      type: args.type,
      contractId: args.contractId,
      installmentId: args.installmentId,
      metadata: args.metadata ?? null,
    }))
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications-resolvers.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/notifications.ts apps/api/tests/notifications-resolvers.test.ts
git commit -m "feat(api): resolvers de destinatário + helpers de notificação"
```

---

## Task 6: Disparar notificações nos eventos de pagamento

**Files:**
- Modify: `apps/api/src/modules/payments.ts`
- Test: `apps/api/tests/notifications.test.ts` (parte 1 — gatilhos)

Mapeamento (alvo = lado que deve ser avisado, nunca o ator):
- comprovante enviado com confirmação → `proof_submitted` para o **approver**.
- comprovante enviado sem confirmação (vira paga) → `installment_paid` para o **approver** (a contraparte).
- confirmar → `payment_confirmed` para o **payer**.
- contestar → `payment_disputed` para o **payer**.

- [ ] **Step 1: Escrever os testes que falham**

Crie `apps/api/tests/notifications.test.ts`. Este arquivo reusa o mesmo harness do `payments.test.ts` (signup/cookie, createContract, etc.) — copie os helpers `signUpCookie`, `createContract`, `firstInstallmentId`, `uploadProof` de `tests/payments.test.ts` para o topo deste arquivo (são pequenos e o plano prioriza arquivos de teste auto-contidos). Adicione um helper de leitura de notificações via endpoint (criado na Task 7) **não** aqui — nesta parte 1 valide direto no banco:

```ts
import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { notification, participant } from "../src/db/schema";

// ── cole aqui os helpers signUpCookie / createContract / firstInstallmentId / uploadProof
//    copiados de tests/payments.test.ts ──

const hasStorage = Boolean(process.env.S3_ENDPOINT);

/** Lê o userId da sessão a partir do cookie (via GET /api/me — retorna { id, name, email, image }). */
async function meId(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/me", { headers: { cookie } })
  );
  return (await res.json()).id as string;
}

async function notifsFor(userId: string, contractId: string) {
  return db
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.contractId, contractId)
      )
    );
}

describe("gatilhos de notificação", () => {
  it.skipIf(!hasStorage)(
    "comprovante enviado (com confirmação) notifica o aprovador, não o ator",
    async () => {
      const ownerCookie = await signUpCookie("payn-own");
      const contractId = await createContract(ownerCookie, true); // requiresConfirmation
      const ownerId = await meId(ownerCookie);

      // vincula um vendedor (aprovador) ao contrato
      const sellerCookie = await signUpCookie("payn-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });

      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId); // owner = comprador = payer = ator

      const toSeller = await notifsFor(sellerId, contractId);
      const toOwner = await notifsFor(ownerId, contractId);
      expect(toSeller.map((n) => n.type)).toContain("proof_submitted");
      expect(toOwner).toHaveLength(0); // ator não se notifica
    }
  );

  it.skipIf(!hasStorage)(
    "sem confirmação: comprovante vira paga e notifica a contraparte",
    async () => {
      const ownerCookie = await signUpCookie("payn-np-own");
      const contractId = await createContract(ownerCookie, false);
      const sellerCookie = await signUpCookie("payn-np-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });
      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId);

      const toSeller = await notifsFor(sellerId, contractId);
      expect(toSeller.map((n) => n.type)).toContain("installment_paid");
    }
  );

  it.skipIf(!hasStorage)(
    "confirmar notifica o pagador",
    async () => {
      const ownerCookie = await signUpCookie("payn-cf-own");
      const contractId = await createContract(ownerCookie, true);
      const ownerId = await meId(ownerCookie);
      const sellerCookie = await signUpCookie("payn-cf-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });
      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId); // payer envia
      await app.handle(
        new Request(
          `http://localhost/api/installments/${instId}/confirm`,
          { method: "POST", headers: { cookie: sellerCookie } }
        )
      ); // aprovador confirma

      const toOwner = await notifsFor(ownerId, contractId);
      expect(toOwner.map((n) => n.type)).toContain("payment_confirmed");
    }
  );
});
```

(Observação: `it.skipIf(!hasStorage)` porque enviar comprovante depende do MinIO/S3, igual ao `payments.test.ts`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: FAIL (notificações não são criadas — arrays vazios).

- [ ] **Step 3: Acoplar os gatilhos em `payments.ts`**

No topo, importe: `import { notifyTarget } from "../lib/notifications";` e `import { NOTIFICATION_TYPE } from "@quitto/shared";`.

No handler de **POST `/proofs`**, dentro da `db.transaction`, logo após o `recordEvent`:

```ts
await notifyTarget(tx, {
  contractId: inst.contractId,
  installmentId: inst.id,
  actorUserId: user.id,
  target: "approver",
  type: c.requiresConfirmation
    ? NOTIFICATION_TYPE.proofSubmitted
    : NOTIFICATION_TYPE.installmentPaid,
  metadata: { fileName: body.fileName },
});
```

No handler de **`/confirm`**, dentro da `db.transaction`, após o `recordEvent`:

```ts
await notifyTarget(tx, {
  contractId: inst.contractId,
  installmentId: inst.id,
  actorUserId: user.id,
  target: "payer",
  type: NOTIFICATION_TYPE.paymentConfirmed,
});
```

No handler de **`/dispute`**, dentro da `db.transaction`, após o `recordEvent` (localize o bloco do dispute — ele grava `type: "payment_disputed"`):

```ts
await notifyTarget(tx, {
  contractId: inst.contractId,
  installmentId: inst.id,
  actorUserId: user.id,
  target: "payer",
  type: NOTIFICATION_TYPE.paymentDisputed,
});
```

Se houver um handler `/mark-paid` separado que grava `installment_paid`, acople também `notifyTarget(..., target: "approver", type: NOTIFICATION_TYPE.installmentPaid)` após o `recordEvent` dele. (Confirme lendo `payments.ts` — a 3a/4c definiram esses endpoints.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: PASS (os testes de gatilho; pulam se sem S3 — garanta MinIO de pé para validar de verdade).

- [ ] **Step 5: Rodar a suíte de payments (não regrediu)**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/payments.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/modules/payments.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): notificações nos eventos de pagamento"
```

---

## Task 7: Endpoints de notificação

**Files:**
- Create: `apps/api/src/modules/notifications.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/notifications.test.ts` (parte 2 — endpoints)

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/api/tests/notifications.test.ts`, adicione um novo `describe`. Estes testes não dependem de storage — semeiam notificações direto no banco e exercitam os endpoints:

```ts
// (reusa o `notification`, `db`, `app`, `eq`, `signUpCookie`, `createContract`, `meId` já no topo do arquivo)

describe("endpoints de notificação", () => {
  async function seed(userId: string, contractId: string, readAt: Date | null) {
    await db.insert(notification).values({
      userId,
      type: "payment_confirmed",
      contractId,
      readAt,
    });
  }

  it("lista só as do próprio usuário e conta as não-lidas", async () => {
    const aCookie = await signUpCookie("notif-a");
    const aId = await meId(aCookie);
    const bCookie = await signUpCookie("notif-b");
    const bId = await meId(bCookie);
    const contractId = await createContract(aCookie, false);

    await seed(aId, contractId, null);
    await seed(aId, contractId, null);
    await seed(bId, contractId, null); // do outro usuário

    const list = await (
      await app.handle(
        new Request("http://localhost/api/notifications", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(list.length).toBe(2);

    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(count.count).toBe(2);
  });

  it("marcar uma como lida zera só ela; cross-user dá 404", async () => {
    const aCookie = await signUpCookie("notif-mr-a");
    const aId = await meId(aCookie);
    const bCookie = await signUpCookie("notif-mr-b");
    const contractId = await createContract(aCookie, false);
    await seed(aId, contractId, null);

    const [row] = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, aId));

    // outro usuário não consegue marcar a notificação alheia
    const forbidden = await app.handle(
      new Request(`http://localhost/api/notifications/${row.id}/read`, {
        method: "POST",
        headers: { cookie: bCookie },
      })
    );
    expect(forbidden.status).toBe(404);

    // dono marca como lida
    const ok = await app.handle(
      new Request(`http://localhost/api/notifications/${row.id}/read`, {
        method: "POST",
        headers: { cookie: aCookie },
      })
    );
    expect(ok.status).toBe(200);

    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(count.count).toBe(0);
  });

  it("read-all zera o contador", async () => {
    const cookie = await signUpCookie("notif-ra");
    const id = await meId(cookie);
    const contractId = await createContract(cookie, false);
    await seed(id, contractId, null);
    await seed(id, contractId, null);

    await app.handle(
      new Request("http://localhost/api/notifications/read-all", {
        method: "POST",
        headers: { cookie },
      })
    );
    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie },
        })
      )
    ).json();
    expect(count.count).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: FAIL (rotas 404 / `count` indefinido).

- [ ] **Step 3: Implementar o módulo**

Crie `apps/api/src/modules/notifications.ts`:

```ts
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { notification } from "../db/schema";
import { NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const LIST_LIMIT = 50;

export const notificationsModule = new Elysia({ prefix: "/api" })
  .get(
    "/notifications",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const rows = await db
        .select()
        .from(notification)
        .where(eq(notification.userId, user.id))
        .orderBy(desc(notification.createdAt))
        .limit(LIST_LIMIT);
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        contractId: r.contractId,
        installmentId: r.installmentId,
        metadata: r.metadata as Record<string, unknown> | null,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          type: t.String(),
          contractId: t.String(),
          installmentId: t.Union([t.String(), t.Null()]),
          metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
          readAt: t.Union([t.String(), t.Null()]),
          createdAt: t.String(),
        })
      ),
    }
  )
  .get(
    "/notifications/unread-count",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const [row] = await db
        .select({ value: count() })
        .from(notification)
        .where(
          and(
            eq(notification.userId, user.id),
            isNull(notification.readAt)
          )
        );
      return { count: row?.value ?? 0 };
    },
    { response: t.Object({ count: t.Number() }) }
  )
  .post(
    "/notifications/:id/read",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const updated = await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.id, params.id),
            eq(notification.userId, user.id)
          )
        )
        .returning({ id: notification.id });
      if (updated.length === 0) {
        throw new NotFoundError("Notificação não encontrada");
      }
      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  )
  .post(
    "/notifications/read-all",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.userId, user.id),
            isNull(notification.readAt)
          )
        );
      return { ok: true as const };
    },
    { response: t.Object({ ok: t.Literal(true) }) }
  );
```

- [ ] **Step 4: Registrar no `app.ts`**

Importe `import { notificationsModule } from "./modules/notifications";` e adicione `.use(notificationsModule)` na cadeia de `buildApp()` (depois de `paymentsModule`).

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: PASS (gatilhos + endpoints).

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/modules/notifications.ts apps/api/src/app.ts apps/api/tests/notifications.test.ts
git commit -m "feat(api): endpoints de notificação (list/unread-count/read/read-all)"
```

---

## Task 8: Cron de lembretes + script

**Files:**
- Create: `apps/api/src/cron/reminders.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/tests/notifications.test.ts` (parte 3 — sweep idempotente)

O entrypoint exporta uma função `runReminderSweep()` testável (que faz o I/O) e, quando rodado como script, a executa e encerra.

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/api/tests/notifications.test.ts`, adicione:

```ts
import { runReminderSweep } from "../src/cron/reminders";

describe("sweep de lembretes", () => {
  it("gera lembrete para parcela vencida e é idempotente", async () => {
    const cookie = await signUpCookie("rem-1");
    const payerId = await meId(cookie);
    // contrato com primeira parcela já vencida
    const res = await app.handle(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title: "Vencida",
          ownerRole: "buyer",
          requiresConfirmation: false,
          schedule: {
            mode: "custom",
            installments: [{ amountCents: 1000, dueDate: "2020-01-01" }],
          },
        }),
      })
    );
    const contractId = (await res.json()).id as string;

    await runReminderSweep();
    await runReminderSweep(); // segunda passada não duplica

    const rows = await db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, payerId),
          eq(notification.contractId, contractId)
        )
      );
    expect(rows.length).toBe(1);
    expect(rows[0]?.type).toBe("installment_overdue");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: FAIL ("Cannot find module ../src/cron/reminders").

- [ ] **Step 3: Implementar o entrypoint**

Crie `apps/api/src/cron/reminders.ts`:

```ts
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { createNotifications, resolvePayerUserIds } from "../lib/notifications";
import { computeReminders, type ReminderInput } from "../lib/reminders";

/** YYYY-MM-DD de hoje (UTC). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Loads open installments of active contracts, resolves payer, persists reminders. Idempotent via dedupeKey. */
export async function runReminderSweep(): Promise<number> {
  const today = todayISO();

  const activeContracts = await db
    .select({ id: contract.id, ownerId: contract.ownerId })
    .from(contract)
    .where(eq(contract.status, "active"));
  if (activeContracts.length === 0) {
    return 0;
  }
  const contractIds = activeContracts.map((c) => c.id);

  const people = await db
    .select({
      contractId: participant.contractId,
      role: participant.role,
      linkedUserId: participant.linkedUserId,
    })
    .from(participant)
    .where(inArray(participant.contractId, contractIds));

  // payer (1º vinculado) por contrato
  const payerByContract = new Map<string, string | null>();
  for (const c of activeContracts) {
    const set = resolvePayerUserIds(
      people.filter((p) => p.contractId === c.id),
      c.ownerId
    );
    payerByContract.set(c.id, set.values().next().value ?? null);
  }

  const openInstallments = await db
    .select({
      id: installment.id,
      contractId: installment.contractId,
      dueDate: installment.dueDate,
    })
    .from(installment)
    .where(
      and(
        inArray(installment.contractId, contractIds),
        ne(installment.status, "paid")
      )
    );

  const inputs: ReminderInput[] = openInstallments.map((i) => ({
    installmentId: i.id,
    contractId: i.contractId,
    dueDate: i.dueDate,
    payerUserId: payerByContract.get(i.contractId) ?? null,
  }));

  const reminders = computeReminders(inputs, today);
  await createNotifications(db, reminders);
  return reminders.length;
}

// Executado diretamente (Fly scheduled Machine / `bun run cron:reminders`).
if (import.meta.main) {
  const created = await runReminderSweep();
  console.log(`[cron:reminders] criados/garantidos ${created} lembretes`);
  process.exit(0);
}
```

- [ ] **Step 4: Adicionar o script ao `package.json`**

Em `apps/api/package.json`, no bloco `scripts`, adicione:

```json
"cron:reminders": "bun run src/cron/reminders.ts"
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/notifications.test.ts`
Expected: PASS (incluindo o teste de idempotência).

- [ ] **Step 6: Smoke do script**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun run cron:reminders`
Expected: imprime `[cron:reminders] criados/garantidos N lembretes` e sai com código 0.

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/cron/reminders.ts apps/api/package.json apps/api/tests/notifications.test.ts
git commit -m "feat(api): cron de lembretes (sweep idempotente)"
```

---

## Task 9: Documentar a Fly scheduled Machine

**Files:**
- Modify: `docs/superpowers/specs/2026-06-13-fase-5-notificacoes-design.md` (anexar nota operacional) ou criar `docs/superpowers/guides/2026-06-13-cron-fly-lembretes.md`

- [ ] **Step 1: Registrar o comando de provisionamento**

Crie `docs/superpowers/guides/2026-06-13-cron-fly-lembretes.md` com:

```markdown
# Cron de lembretes — Fly scheduled Machine

O sweep diário roda como uma **scheduled Machine** no mesmo app Fly, usando a mesma imagem.

## Provisionar (1×)

```bash
fly machine run . \
  --schedule daily \
  --app <nome-do-app> \
  --entrypoint "bun run cron:reminders"
```

- `--schedule daily`: o Fly sobe a Machine 1×/dia, roda o entrypoint e a Machine encerra.
- Reusa os secrets do app (`DATABASE_URL` etc.) — **nenhum secret novo**.
- O sweep é idempotente (`dedupeKey`), então reexecuções não duplicam lembretes.

## Verificar

```bash
fly machine list --app <nome-do-app>   # deve listar a machine agendada
fly logs --app <nome-do-app>           # procurar "[cron:reminders] criados/garantidos N lembretes"
```

## Trocar de gatilho no futuro

`runReminderSweep()` é uma função isolada. Para mover o gatilho para um endpoint HTTP
(disparado por GitHub Actions, por ex.), basta exportá-la por uma rota protegida — sem tocar
no domínio (`computeReminders`).
```

- [ ] **Step 2: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/guides/2026-06-13-cron-fly-lembretes.md
git commit -m "docs: guia de provisionamento do cron de lembretes no Fly"
```

---

## Task 10: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte completa da API**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test`
Expected: tudo verde (os testes de storage/payments/notifications exigem MinIO de pé; garanta os envs S3).

- [ ] **Step 2: Typecheck + lint do monorepo**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 3: Marcar a 5a no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, troque a célula de plano da linha **5a** de `a escrever` para:
`` `plans/2026-06-13-fase-5a-notificacoes-api.md` ✅ **concluído** (merge em `develop`; suite verde — gatilhos de pagamento, endpoints escopados ao usuário, sweep idempotente via dedupeKey, cron documentado no Fly) ``

- [ ] **Step 4: Commit do roadmap**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 5a concluída no roadmap"
```

- [ ] **Step 5: Merge em `develop`**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git checkout develop
git merge --no-ff feat/fase-5a-notificacoes-api -m "Merge: Fase 5a — notificações + lembretes (API + cron)"
```

Expected: merge limpo; `bun test` da API verde em `develop`.

---

## Notas para o executor

- **Idioma:** código/identificadores/rotas/comentários em **inglês**; conteúdo de UI/mensagens em **pt-BR** (aqui só há API — mensagens de erro pt-BR seguem o padrão dos outros módulos).
- **Sem literais:** use `NOTIFICATION_TYPE.*` e `REMINDER_WINDOW_DAYS`; nada de strings cruas de tipo.
- **Eden:** ao registrar `notificationsModule`, confirme que `apps/web` enxerga os tipos cross-package (o build do shared/api já roda no typecheck). A 5b consumirá esses endpoints.
- **Reaproveite o harness de teste** do `payments.test.ts` — não reinvente signup/cookie.
- Se algum endpoint `/mark-paid` existir em `payments.ts` e gravar `installment_paid`, acople o `notifyTarget` nele também (Task 6, Step 3).
