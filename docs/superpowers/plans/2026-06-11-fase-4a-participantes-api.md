# Fase 4a — Participantes & Convites (API) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:subagent-driven-development` + `superpowers:react-clean-architecture` (mesmo no back: lógica pura testável, sem valores mágicos — use as constantes de `@quitto/shared`). Steps com checkbox. Bugs/edge: teste primeiro.

**Goal:** Backend de compartilhamento — owner adiciona/remove **participantes** (contatos), gera **convite por link travado por e-mail** (token aleatório, expira, uso único), e o convidado **aceita** vinculando-se ao slot (só se o e-mail da sessão bater). Inclui o **nome do ator** na timeline de auditoria (item deferido da 3b). Sem UI (4b).

**Architecture:** Convite travado por e-mail: o owner informa o e-mail ao convidar; só uma sessão cujo `user.email` (normalizado) bate aceita. RBAC reusa `getContractRole` (owner gerencia participantes/convites; só linka quem casa o e-mail). Módulos Elysia no padrão (`prefix:"/api"`, `requireAuth`, TypeBox, transações Drizzle). Constantes de papel vêm de `@quitto/shared` (`PARTICIPANT_ROLE`).

**Tech Stack:** Elysia + TypeBox, Drizzle, `node:crypto` (token), `bun test`.

> **Convenção:** código/rotas/comentários em inglês; mensagens pt-BR; sem literais de domínio (use `PARTICIPANT_ROLE`).
> **Pré-requisitos:** Fases 0–3 em `develop`. Postgres de pé. Branch `feat/fase-4a-participantes-api` a partir de `develop`. Ao fim, merge em `develop`.

---

## Estrutura de arquivos (novos/alterados)

```
apps/api/
├─ src/
│  ├─ db/schema.ts            # + tabela invite
│  ├─ lib/email.ts            # normalizeEmail (novo)
│  ├─ modules/
│  │  ├─ participants.ts      # add/remove participante + criar convite (owner) (novo)
│  │  └─ invites.ts           # GET /api/invites/:token + accept (auth + e-mail) (novo)
│  ├─ modules/payments.ts     # timeline com actorName (alterado)
│  └─ app.ts                  # + participantsModule, invitesModule
└─ tests/
   ├─ email.test.ts
   ├─ participants.test.ts
   └─ invites.test.ts
```

---

## Task 1: Schema — tabela `invite` + migração

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Adicionar ao fim de `schema.ts`**

```ts
export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("invite_token_idx").on(table.token)]
);
```

- [ ] **Step 2: Gerar e aplicar a migração**

Run (em `apps/api`, com envs): `bun run db:generate && bun run db:migrate`
Expected: cria/aplica `drizzle/0005_*.sql` com a tabela `invite`.

- [ ] **Step 3: Typecheck + commit**

Run: `bun --filter @quitto/api typecheck`

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle
git commit -m "feat(api): tabela invite (token + e-mail + expiração) + migração"
```

---

## Task 2: `lib/email.ts` — normalizar e-mail (TDD)

**Files:**
- Create: `apps/api/src/lib/email.ts`
- Test: `apps/api/tests/email.test.ts`

- [ ] **Step 1: Teste**

Create `apps/api/tests/email.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { normalizeEmail } from "../src/lib/email";

describe("normalizeEmail", () => {
  it("baixa caixa e remove espaços", () => {
    expect(normalizeEmail("  Joao@Example.COM ")).toBe("joao@example.com");
  });
  it("é estável (idempotente)", () => {
    expect(normalizeEmail(normalizeEmail("A@B.com"))).toBe("a@b.com");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/email.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `apps/api/src/lib/email.ts`**

```ts
/** Lowercases and trims an email for case-insensitive comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

- [ ] **Step 4: Rodar e ver passar + commit**

Run: `bun --filter @quitto/api test tests/email.test.ts`

```bash
git add apps/api/src/lib/email.ts apps/api/tests/email.test.ts
git commit -m "feat(api): normalizeEmail (comparação case-insensitive)"
```

---

## Task 3: `participants.ts` — adicionar/remover participante (owner)

**Files:**
- Create: `apps/api/src/modules/participants.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/participants.test.ts`

- [ ] **Step 1: Criar `apps/api/src/modules/participants.ts`**

```ts
import { PARTICIPANT_ROLE } from "@quitto/shared";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const INVITABLE_ROLES = [
  PARTICIPANT_ROLE.buyer,
  PARTICIPANT_ROLE.seller,
  PARTICIPANT_ROLE.viewer,
] as const;

async function requireOwner(userId: string, contractId: string) {
  const role = await getContractRole(userId, contractId); // 404 se sem acesso
  if (role !== PARTICIPANT_ROLE.owner) {
    throw new ForbiddenError("Apenas o dono gerencia participantes");
  }
}

export const participantsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts/:id/participants",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);
      const [created] = await db
        .insert(participant)
        .values({ contractId: params.id, displayName: body.displayName, role: body.role })
        .returning({ id: participant.id });
      return { id: created!.id };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 120 }),
        role: t.Union(INVITABLE_ROLES.map((r) => t.Literal(r))),
      }),
      response: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/contracts/:id/participants/:participantId",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);
      const [target] = await db
        .select()
        .from(participant)
        .where(
          and(eq(participant.id, params.participantId), eq(participant.contractId, params.id)),
        )
        .limit(1);
      if (!target) {
        throw new NotFoundError("Participante não encontrado");
      }
      if (target.role === PARTICIPANT_ROLE.owner) {
        throw new ForbiddenError("O dono não pode ser removido");
      }
      await db.delete(participant).where(eq(participant.id, params.participantId));
      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String(), participantId: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    },
  );
```

- [ ] **Step 2: Registrar no `app.ts`** (`import { participantsModule }` + `.use(participantsModule)`)

- [ ] **Step 3: Teste**

Create `apps/api/tests/participants.test.ts` (reuse helpers de `contracts.test.ts`: signUp cookie + createContract; copie-os ou extraia para um helper de teste se preferir):

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function cookie(tag: string) {
  const r = await app.handle(new Request("http://localhost/api/auth/sign-up/email", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "T", email: `${tag}-${Date.now()}@e.com`, password: "password123" }),
  }));
  return (r.headers.get("set-cookie") as string).split(";")[0] as string;
}
async function newContract(c: string) {
  const r = await app.handle(new Request("http://localhost/api/contracts", {
    method: "POST", headers: { "content-type": "application/json", cookie: c },
    body: JSON.stringify({ title: "C", ownerRole: "buyer", requiresConfirmation: true,
      schedule: { mode: "auto", totalAmountCents: 3000, installmentsCount: 3, firstDueDate: "2026-07-10" } }),
  }));
  return (await r.json()).id as string;
}

describe("participants", () => {
  it("owner adiciona participante; estranho recebe 404", async () => {
    const owner = await cookie("po");
    const id = await newContract(owner);
    const ok = await app.handle(new Request(`http://localhost/api/contracts/${id}/participants`, {
      method: "POST", headers: { "content-type": "application/json", cookie: owner },
      body: JSON.stringify({ displayName: "Irmão", role: "seller" }),
    }));
    expect(ok.status).toBe(200);

    const stranger = await cookie("ps");
    const denied = await app.handle(new Request(`http://localhost/api/contracts/${id}/participants`, {
      method: "POST", headers: { "content-type": "application/json", cookie: stranger },
      body: JSON.stringify({ displayName: "X", role: "viewer" }),
    }));
    expect(denied.status).toBe(404); // não vaza existência
  });
});
```

- [ ] **Step 4: Rodar + commit**

Run (Postgres + envs): `bun --filter @quitto/api test tests/participants.test.ts`

```bash
git add apps/api/src/modules/participants.ts apps/api/src/app.ts apps/api/tests/participants.test.ts
git commit -m "feat(api): adicionar/remover participante (owner)"
```

---

## Task 4: Criar convite (owner) — token + e-mail + expiração

**Files:**
- Modify: `apps/api/src/modules/participants.ts`
- Test: `apps/api/tests/participants.test.ts`

- [ ] **Step 1: Adicionar imports e o handler no `participantsModule`** (encadeie após o `.delete`)

Topo (combine): `import { randomBytes } from "node:crypto";` · `import { invite } from "../db/schema";` · `import { normalizeEmail } from "../lib/email";`

```ts
const INVITE_TTL_DAYS = 7;

// ...encadeado no participantsModule:
  .post(
    "/contracts/:id/participants/:participantId/invite",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);

      const [target] = await db
        .select()
        .from(participant)
        .where(
          and(eq(participant.id, params.participantId), eq(participant.contractId, params.id)),
        )
        .limit(1);
      if (!target) {
        throw new NotFoundError("Participante não encontrado");
      }
      if (target.linkedUserId) {
        throw new ForbiddenError("Participante já vinculado a um usuário");
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
      await db.insert(invite).values({
        contractId: params.id,
        participantId: params.participantId,
        email: normalizeEmail(body.email),
        token,
        expiresAt,
      });
      return { token, expiresAt: expiresAt.toISOString() };
    },
    {
      params: t.Object({ id: t.String(), participantId: t.String() }),
      body: t.Object({ email: t.String({ format: "email", minLength: 3, maxLength: 200 }) }),
      response: t.Object({ token: t.String(), expiresAt: t.String() }),
    },
  );
```

> **Nota:** `Date.now()`/`new Date()` são permitidos no runtime (a proibição vale só p/ scripts de workflow). O token é 32 bytes aleatórios (256 bits) — não adivinhável.

- [ ] **Step 2: Teste do convite** (acrescente ao describe)

```ts
it("owner gera convite com token e expiração", async () => {
  const owner = await cookie("inv");
  const id = await newContract(owner);
  const p = await (await app.handle(new Request(`http://localhost/api/contracts/${id}/participants`, {
    method: "POST", headers: { "content-type": "application/json", cookie: owner },
    body: JSON.stringify({ displayName: "Irmão", role: "seller" }),
  }))).json();
  const res = await app.handle(new Request(`http://localhost/api/contracts/${id}/participants/${p.id}/invite`, {
    method: "POST", headers: { "content-type": "application/json", cookie: owner },
    body: JSON.stringify({ email: "irmao@example.com" }),
  }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.token).toHaveLength(64); // 32 bytes em hex
});
```

- [ ] **Step 3: Rodar + commit**

Run: `bun --filter @quitto/api test tests/participants.test.ts`

```bash
git add apps/api/src/modules/participants.ts apps/api/tests/participants.test.ts
git commit -m "feat(api): criar convite por participante (token + e-mail + expiração)"
```

---

## Task 5: `invites.ts` — ver e aceitar convite (auth + trava de e-mail)

**Files:**
- Create: `apps/api/src/modules/invites.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/invites.test.ts`

- [ ] **Step 1: Criar `apps/api/src/modules/invites.ts`**

```ts
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, invite, participant } from "../db/schema";
import { normalizeEmail } from "../lib/email";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

async function loadValidInvite(token: string) {
  const [row] = await db.select().from(invite).where(eq(invite.token, token)).limit(1);
  if (!row) {
    throw new NotFoundError("Convite não encontrado");
  }
  if (row.acceptedAt) {
    throw new ValidationError("Convite já utilizado");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("Convite expirado");
  }
  return row;
}

export const invitesModule = new Elysia({ prefix: "/api" })
  .get(
    "/invites/:token",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const row = await loadValidInvite(params.token);
      const [c] = await db.select().from(contract).where(eq(contract.id, row.contractId)).limit(1);
      const [p] = await db.select().from(participant).where(eq(participant.id, row.participantId)).limit(1);
      return {
        contractTitle: c!.title,
        role: p!.role,
        email: row.email,
        emailMatches: normalizeEmail(user.email) === row.email,
      };
    },
    {
      params: t.Object({ token: t.String() }),
      response: t.Object({
        contractTitle: t.String(),
        role: t.String(),
        email: t.String(),
        emailMatches: t.Boolean(),
      }),
    },
  )
  .post(
    "/invites/:token/accept",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const row = await loadValidInvite(params.token);
      if (normalizeEmail(user.email) !== row.email) {
        throw new ForbiddenError("Este convite é para outro e-mail");
      }
      const contractId = await db.transaction(async (tx) => {
        await tx
          .update(participant)
          .set({ linkedUserId: user.id })
          .where(eq(participant.id, row.participantId));
        await tx
          .update(invite)
          .set({ acceptedByUserId: user.id, acceptedAt: new Date() })
          .where(eq(invite.id, row.id));
        return row.contractId;
      });
      return { contractId };
    },
    {
      params: t.Object({ token: t.String() }),
      response: t.Object({ contractId: t.String() }),
    },
  );
```

- [ ] **Step 2: Registrar no `app.ts`** (`import { invitesModule }` + `.use(invitesModule)`)

- [ ] **Step 3: Teste (aceitar com e-mail certo; recusar errado; expirado/reuso)**

Create `apps/api/tests/invites.test.ts` (helpers locais + criação de convite). Cubra:
- e-mail **bate** → `accept` 200 e o participante fica vinculado (detalhe do contrato acessível pelo convidado).
- e-mail **não bate** → `accept` 403.
- **reuso** → segundo `accept` 422 ("já utilizado").

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function cookieFor(email: string) {
  const r = await app.handle(new Request("http://localhost/api/auth/sign-up/email", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "T", email, password: "password123" }),
  }));
  return (r.headers.get("set-cookie") as string).split(";")[0] as string;
}
async function setupInvite(ownerCookie: string, inviteeEmail: string) {
  const c = await (await app.handle(new Request("http://localhost/api/contracts", {
    method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ title: "C", ownerRole: "buyer", requiresConfirmation: true,
      schedule: { mode: "auto", totalAmountCents: 3000, installmentsCount: 3, firstDueDate: "2026-07-10" } }),
  }))).json();
  const p = await (await app.handle(new Request(`http://localhost/api/contracts/${c.id}/participants`, {
    method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ displayName: "Conv", role: "seller" }),
  }))).json();
  const inv = await (await app.handle(new Request(`http://localhost/api/contracts/${c.id}/participants/${p.id}/invite`, {
    method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ email: inviteeEmail }),
  }))).json();
  return { contractId: c.id, token: inv.token as string };
}

describe("invites", () => {
  it("aceita quando o e-mail bate e vincula o participante", async () => {
    const ts = Date.now();
    const owner = await cookieFor(`own-${ts}@e.com`);
    const inviteeEmail = `friend-${ts}@e.com`;
    const { contractId, token } = await setupInvite(owner, inviteeEmail);
    const invitee = await cookieFor(inviteeEmail);
    const acc = await app.handle(new Request(`http://localhost/api/invites/${token}/accept`, {
      method: "POST", headers: { cookie: invitee },
    }));
    expect(acc.status).toBe(200);
    // agora o convidado acessa o contrato
    const detail = await app.handle(new Request(`http://localhost/api/contracts/${contractId}`, { headers: { cookie: invitee } }));
    expect(detail.status).toBe(200);
  });

  it("recusa quando o e-mail não bate (403)", async () => {
    const ts = Date.now();
    const owner = await cookieFor(`own2-${ts}@e.com`);
    const { token } = await setupInvite(owner, `target-${ts}@e.com`);
    const other = await cookieFor(`other-${ts}@e.com`);
    const acc = await app.handle(new Request(`http://localhost/api/invites/${token}/accept`, {
      method: "POST", headers: { cookie: other },
    }));
    expect(acc.status).toBe(403);
  });

  it("recusa reuso (422)", async () => {
    const ts = Date.now();
    const owner = await cookieFor(`own3-${ts}@e.com`);
    const email = `reuse-${ts}@e.com`;
    const { token } = await setupInvite(owner, email);
    const invitee = await cookieFor(email);
    await app.handle(new Request(`http://localhost/api/invites/${token}/accept`, { method: "POST", headers: { cookie: invitee } }));
    const again = await app.handle(new Request(`http://localhost/api/invites/${token}/accept`, { method: "POST", headers: { cookie: invitee } }));
    expect(again.status).toBe(422);
  });
});
```

- [ ] **Step 4: Rodar + commit**

Run: `bun --filter @quitto/api test tests/invites.test.ts`
Expected: PASS (3 testes).

```bash
git add apps/api/src/modules/invites.ts apps/api/src/app.ts apps/api/tests/invites.test.ts
git commit -m "feat(api): ver/aceitar convite (auth + trava de e-mail, expira, uso único)"
```

---

## Task 6: Timeline com nome do ator (item deferido da 3b)

**Files:**
- Modify: `apps/api/src/modules/payments.ts` (handler `GET /api/installments/:installmentId`)
- Test: `apps/api/tests/payments.test.ts`

- [ ] **Step 1: Incluir `actorName` nos eventos**

No handler de detalhe da parcela, troque a query de `auditEvent` por um `leftJoin` em `user` para trazer o nome, e inclua `actorName` no retorno + no `response` schema:

```ts
import { user as userTable } from "../db/schema";
```
```ts
      const events = await db
        .select({
          id: auditEvent.id,
          type: auditEvent.type,
          createdAt: auditEvent.createdAt,
          actorName: userTable.name,
        })
        .from(auditEvent)
        .leftJoin(userTable, eq(auditEvent.actorUserId, userTable.id))
        .where(eq(auditEvent.installmentId, inst.id))
        .orderBy(desc(auditEvent.createdAt));
```
```ts
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          actorName: e.actorName ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
```
No `response`, o item de evento vira:
```ts
        events: t.Array(
          t.Object({
            id: t.String(),
            type: t.String(),
            actorName: t.Union([t.String(), t.Null()]),
            createdAt: t.String(),
          }),
        ),
```

- [ ] **Step 2: Ajustar o teste existente** de detalhe da parcela em `payments.test.ts` para assertar `actorName`:

```ts
    expect(body.events[0]).toHaveProperty("actorName");
```

- [ ] **Step 3: Rodar + commit**

Run (Postgres + MinIO + envs): `bun --filter @quitto/api test tests/payments.test.ts`

```bash
git add apps/api/src/modules/payments.ts apps/api/tests/payments.test.ts
git commit -m "feat(api): nome do ator na timeline de auditoria"
```

---

## Task 7: Fechar — suite, Eden e merge

- [ ] **Step 1: Suite + lint + typecheck + build**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde.

- [ ] **Step 2: Eden tipa os novos endpoints**

Run: `bun --filter @quitto/web test eden`
Expected: PASS (`api.api.contracts[...].participants`, `api.api.invites[...]`).

- [ ] **Step 3: Merge + roadmap**

```bash
git checkout develop
git merge --no-ff feat/fase-4a-participantes-api -m "Merge da Fase 4a (participantes/convites API) em develop"
git add docs/superpowers/ROADMAP.md && git commit -m "docs: marca a Fase 4a como concluída"
```

---

## Self-Review (cobertura)

- **Adicionar/remover participante (owner; 404 sem vazar):** Task 3 ✅
- **Convite por link, travado por e-mail (token aleatório, expira, uso único):** Tasks 1, 2, 4, 5 ✅
- **Aceitar vincula o slot; e-mail errado → 403; reuso → 422:** Task 5 ✅
- **RBAC efetivo p/ não-owner** (acessa o contrato após vincular): coberto pelo `getContractRole` existente + teste em Task 5 ✅
- **Nome do ator na timeline (deferido da 3b):** Task 6 ✅
- **Constantes de domínio (sem literais de papel):** `PARTICIPANT_ROLE` em Task 3/4 ✅
- **Fora de escopo (4b):** UI — gerenciar participantes, gerar/copiar link de convite, tela de aceitar convite, exibir nome do ator na timeline.

> **Segurança:** token de 256 bits; comparação de e-mail normalizada; convite expira (7d) e é uso único; só o owner cria/gerencia; aceitar exige sessão. Não vaza existência de contrato (404). Revogar convite (DELETE) fica como melhoria simples na 4b/Polimento se desejado.
