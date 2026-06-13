# Fase 4b — Participantes & Convites (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. REQUIRED também: `superpowers:react-clean-architecture` (lógica em hooks, componentes apresentacionais, sem valores mágicos — constantes de `@quitto/shared`, rótulos em `lib/labels`).

**Goal:** UI de compartilhamento — o dono gerencia participantes e gera links de convite num drawer; o convidado aceita o convite numa tela própria; convites pendentes são descobertos ao logar; e o nome do ator aparece na timeline de auditoria.

**Architecture:** Frontend React 19 + TanStack Router/Query + RHF/Zod, consumindo a API da Fase 4a via Eden treaty. Uma única adição de backend: `GET /api/invites/mine` (convites pendentes do e-mail da sessão). Gestão de participantes num `Sheet` (drawer, tela inteira no mobile); aceitar/descoberta como página/banner; sem modais centralizados exceto o confirm de remover.

**Tech Stack:** Elysia + TypeBox + Drizzle (backend), React 19 + TanStack Router/Query + React Hook Form + Zod + Tailwind + Radix (web), `bun test` (API) e `vitest` + Testing Library (web).

> **Convenção (spec §9):** código/rotas/comentários em inglês; mensagens pt-BR; sem literais de domínio (use `PARTICIPANT_ROLE`/`AUDIT_TYPE` de `@quitto/shared`).
> **Pré-requisitos:** Fase 4a em `develop`. Postgres + MinIO de pé (envs em `apps/api/.env`). Branch `feat/fase-4b-participantes-ui` a partir de `develop`. Ao fim, merge em `develop`.
> **Spec de referência:** `docs/superpowers/specs/2026-06-12-fase-4b-participantes-ui-design.md`.

---

## Estrutura de arquivos (novos/alterados)

```
packages/shared/src/index.ts        # + addParticipantSchema, createInviteSchema, INVITABLE_PARTICIPANT_ROLES (alterado)
apps/api/
├─ src/modules/invites.ts           # + GET /api/invites/mine (alterado)
└─ tests/invites.test.ts            # + testes de /invites/mine (alterado)
apps/web/
├─ src/
│  ├─ lib/query-keys.ts             # + invite(token), myInvites (alterado)
│  ├─ lib/labels.ts                 # + AUDIT_TYPE_LABEL (alterado)
│  ├─ hooks/use-participant-mutations.ts  # add/remove/criar convite (novo)
│  ├─ hooks/use-invite.ts           # ver + aceitar convite (novo)
│  ├─ hooks/use-my-invites.ts       # convites pendentes do meu e-mail (novo)
│  ├─ components/copy-button.tsx    # botão copiar com feedback (novo)
│  ├─ components/add-participant-form.tsx  # form RHF+Zod (novo)
│  ├─ components/participants-drawer.tsx   # Sheet de gestão (novo)
│  ├─ components/pending-invites-banner.tsx  # banner de descoberta (novo)
│  ├─ components/audit-timeline.tsx # + actorName, usa AUDIT_TYPE_LABEL (alterado)
│  ├─ routes/accept-invite.tsx      # tela de aceitar (novo)
│  ├─ routes/contract-detail.tsx    # + botão "Gerenciar" + drawer (alterado)
│  ├─ routes/contracts-list.tsx     # + banner (alterado)
│  ├─ routes/protected.tsx          # redirect round-trip (alterado)
│  ├─ routes/login.tsx              # honra ?redirect (alterado)
│  └─ router.tsx                    # + rota /invites/$token (alterado)
└─ tests/
   ├─ copy-button.test.tsx          (novo)
   ├─ add-participant-form.test.tsx (novo)
   ├─ participants-drawer.test.tsx  (novo)
   ├─ accept-invite.test.tsx        (novo)
   ├─ pending-invites-banner.test.tsx (novo)
   ├─ audit-timeline.test.tsx       (novo)
   └─ eden-types.test.ts            # + invites.mine (alterado)
```

---

## Task 1: Backend — `GET /api/invites/mine`

**Files:**
- Modify: `apps/api/src/modules/invites.ts`
- Test: `apps/api/tests/invites.test.ts`
- Modify: `apps/web/tests/eden-types.test.ts`

- [ ] **Step 1: Escrever os testes (TDD)** — acrescente ao `describe("invites", ...)` em `apps/api/tests/invites.test.ts`. Reuse os helpers locais já existentes no arquivo (`cookieFor`, `setupInvite`). Adicione:

```ts
it("GET /invites/mine lista convites pendentes do e-mail da sessão", async () => {
  const ts = Date.now();
  const owner = await cookieFor(`mine-own-${ts}@e.com`);
  const inviteeEmail = `mine-friend-${ts}@e.com`;
  const { contractId } = await setupInvite(owner, inviteeEmail);
  const invitee = await cookieFor(inviteeEmail);

  const res = await app.handle(
    new Request("http://localhost/api/invites/mine", {
      headers: { cookie: invitee },
    })
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(1);
  expect(body[0].contractTitle).toBe("C");
  expect(body[0].role).toBe("seller");
  expect(typeof body[0].token).toBe("string");
  expect(contractId).toBeTruthy();
});

it("GET /invites/mine não retorna convites de outro e-mail", async () => {
  const ts = Date.now();
  const owner = await cookieFor(`mine-own2-${ts}@e.com`);
  await setupInvite(owner, `mine-target-${ts}@e.com`);
  const other = await cookieFor(`mine-other-${ts}@e.com`);

  const res = await app.handle(
    new Request("http://localhost/api/invites/mine", {
      headers: { cookie: other },
    })
  );
  expect(res.status).toBe(200);
  expect((await res.json()).length).toBe(0);
});

it("GET /invites/mine exclui convites já aceitos", async () => {
  const ts = Date.now();
  const owner = await cookieFor(`mine-own3-${ts}@e.com`);
  const email = `mine-accepted-${ts}@e.com`;
  const { token } = await setupInvite(owner, email);
  const invitee = await cookieFor(email);
  await app.handle(
    new Request(`http://localhost/api/invites/${token}/accept`, {
      method: "POST",
      headers: { cookie: invitee },
    })
  );

  const res = await app.handle(
    new Request("http://localhost/api/invites/mine", {
      headers: { cookie: invitee },
    })
  );
  expect(res.status).toBe(200);
  expect((await res.json()).length).toBe(0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/api test tests/invites.test.ts`
Expected: FAIL (a rota `/invites/mine` ainda não existe; cai no handler de `:token` ou 404).

- [ ] **Step 3: Implementar a rota em `apps/api/src/modules/invites.ts`**

No topo, garanta que os imports incluam `and`, `eq`, `gt`, `isNull` de `drizzle-orm` (hoje só importa `eq` — acrescente os demais):

```ts
import { and, eq, gt, isNull } from "drizzle-orm";
```

Encadeie um novo `.get` no `invitesModule` **antes** do `.get("/invites/:token", ...)` (em Elysia rotas estáticas têm prioridade sobre dinâmicas, mas registrar antes deixa a intenção clara):

```ts
  .get(
    "/invites/mine",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const email = normalizeEmail(user.email);
      const rows = await db
        .select({
          token: invite.token,
          contractTitle: contract.title,
          role: participant.role,
          expiresAt: invite.expiresAt,
        })
        .from(invite)
        .innerJoin(contract, eq(invite.contractId, contract.id))
        .innerJoin(participant, eq(invite.participantId, participant.id))
        .where(
          and(
            eq(invite.email, email),
            isNull(invite.acceptedAt),
            gt(invite.expiresAt, new Date())
          )
        )
        .orderBy(desc(invite.createdAt));
      return rows.map((r) => ({
        token: r.token,
        contractTitle: r.contractTitle,
        role: r.role,
        expiresAt: r.expiresAt.toISOString(),
      }));
    },
    {
      response: t.Array(
        t.Object({
          token: t.String(),
          contractTitle: t.String(),
          role: t.String(),
          expiresAt: t.String(),
        })
      ),
    }
  )
```

Garanta que `desc` esteja importado de `drizzle-orm` (se não estiver, acrescente). `contract`, `invite`, `participant`, `normalizeEmail`, `requireAuth`, `db`, `t` já são importados no arquivo.

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/api test tests/invites.test.ts`
Expected: PASS (os 3 novos + os existentes).

- [ ] **Step 5: Adicionar a asserção de tipo Eden** — em `apps/web/tests/eden-types.test.ts`, dentro do bloco `it("infers the Fase-4a participants/invites endpoints ...")` (ou um novo `it` para a 4b), acrescente antes do fechamento:

```ts
  // GET /api/invites/mine — response is an array of pending invites.
  const mineGet = api.api.invites.mine.get;
  type MineResponse = Awaited<ReturnType<typeof mineGet>>["data"];
  expectTypeOf<MineResponse>().not.toBeAny();
  type MineItem = NonNullable<MineResponse>[number];
  expectTypeOf<MineItem["token"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["contractTitle"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["role"]>().toEqualTypeOf<string>();
  expectTypeOf<MineItem["expiresAt"]>().toEqualTypeOf<string>();
```

- [ ] **Step 6: Typecheck (gate Eden) + commit**

Run: `bun --filter @quitto/web typecheck` (compila as asserções `expectTypeOf`) e `bun --filter @quitto/api typecheck`
Expected: ambos exit 0.

```bash
git add apps/api/src/modules/invites.ts apps/api/tests/invites.test.ts apps/web/tests/eden-types.test.ts
git commit -m "feat(api): GET /api/invites/mine (convites pendentes do e-mail) + tipo Eden"
```

---

## Task 2: Shared — schemas de form (`addParticipantSchema`, `createInviteSchema`)

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Adicionar os schemas ao fim de `packages/shared/src/index.ts`**

`PARTICIPANT_ROLE` já é importado do `./domain` no topo do arquivo? Não — hoje o index reexporta `PARTICIPANT_ROLE` de `./domain` no bloco de `export {...}`. Para usá-lo aqui, importe-o explicitamente no topo (junto do import existente `import { OWNER_ROLES } from "./domain";`):

```ts
import { OWNER_ROLES, PARTICIPANT_ROLE } from "./domain";
```

Ao fim do arquivo, acrescente:

```ts
// ── Participants & invites ───────────────────────────────────────────────────

/** Papéis que o dono pode atribuir a um participante (owner não é convidável). */
export const INVITABLE_PARTICIPANT_ROLES = [
  PARTICIPANT_ROLE.buyer,
  PARTICIPANT_ROLE.seller,
  PARTICIPANT_ROLE.viewer,
] as const;

export const addParticipantSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(120, "Máximo 120 caracteres"),
  role: z.enum(INVITABLE_PARTICIPANT_ROLES),
});
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "E-mail inválido")
    .max(200, "Máximo 200 caracteres")
    .email("E-mail inválido"),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
```

- [ ] **Step 2: Typecheck + commit**

Run: `bun --filter @quitto/shared typecheck`
Expected: exit 0.

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): schemas addParticipant/createInvite + INVITABLE_PARTICIPANT_ROLES"
```

---

## Task 3: Web — query keys + hooks de dados

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/hooks/use-participant-mutations.ts`
- Create: `apps/web/src/hooks/use-invite.ts`
- Create: `apps/web/src/hooks/use-my-invites.ts`

- [ ] **Step 1: Estender `apps/web/src/lib/query-keys.ts`**

```ts
/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
  invite: (token: string) => ["invite", token] as const,
  myInvites: ["my-invites"] as const,
};
```

- [ ] **Step 2: Criar `apps/web/src/hooks/use-participant-mutations.ts`**

```ts
import {
  type AddParticipantInput,
  type CreateInviteInput,
} from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useAddParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddParticipantInput) =>
      unwrap(api.api.contracts({ id: contractId }).participants.post(body)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
  });
}

export function useRemoveParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .delete()
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
  });
}

export function useCreateInviteMutation(contractId: string) {
  return useMutation({
    mutationFn: ({
      participantId,
      body,
    }: {
      participantId: string;
      body: CreateInviteInput;
    }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .invite.post(body)
      ),
  });
}
```

- [ ] **Step 3: Criar `apps/web/src/hooks/use-invite.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/invites/:token — preview do convite (título, papel, emailMatches). */
export const inviteQueryOptions = (token: string) =>
  queryOptions({
    queryKey: queryKeys.invite(token),
    queryFn: () => unwrap(api.api.invites({ token }).get()),
  });

export function useInviteQuery(token: string) {
  return useQuery(inviteQueryOptions(token));
}

export function useAcceptInviteMutation(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).accept.post()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.myInvites });
    },
  });
}
```

- [ ] **Step 4: Criar `apps/web/src/hooks/use-my-invites.ts`**

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/invites/mine — convites pendentes do e-mail da sessão. */
export const myInvitesQueryOptions = queryOptions({
  queryKey: queryKeys.myInvites,
  queryFn: () => unwrap(api.api.invites.mine.get()),
});

export function useMyInvitesQuery() {
  return useQuery(myInvitesQueryOptions);
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `bun --filter @quitto/web typecheck`
Expected: exit 0.

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/use-participant-mutations.ts apps/web/src/hooks/use-invite.ts apps/web/src/hooks/use-my-invites.ts
git commit -m "feat(web): query keys + hooks de participantes/convites"
```

---

## Task 4: Web — `CopyButton`

**Files:**
- Create: `apps/web/src/components/copy-button.tsx`
- Test: `apps/web/tests/copy-button.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/copy-button.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "../src/components/copy-button";
import { renderWithProviders } from "./test-utils";

describe("CopyButton", () => {
  it("copia o valor e mostra feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithProviders(<CopyButton value="https://x/invites/abc" />);
    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));

    expect(writeText).toHaveBeenCalledWith("https://x/invites/abc");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /copiado/i })).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test copy-button`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar `apps/web/src/components/copy-button.tsx`**

```tsx
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies `value` to the clipboard and shows a transient "Copiado!" state. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      className="gap-2"
      onClick={onCopy}
      type="button"
      variant="outline"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}
```

- [ ] **Step 4: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test copy-button`
Expected: PASS.

```bash
git add apps/web/src/components/copy-button.tsx apps/web/tests/copy-button.test.tsx
git commit -m "feat(web): CopyButton (copiar com feedback)"
```

---

## Task 5: Web — `AddParticipantForm`

**Files:**
- Create: `apps/web/src/components/add-participant-form.tsx`
- Test: `apps/web/tests/add-participant-form.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/add-participant-form.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutateAsync = vi.fn().mockResolvedValue({ id: "p9" });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({ mutateAsync, isPending: false }),
}));

import { AddParticipantForm } from "../src/components/add-participant-form";

describe("AddParticipantForm", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("envia nome + papel e chama onDone", async () => {
    const onDone = vi.fn();
    renderWithProviders(
      <AddParticipantForm contractId="c1" onDone={onDone} />
    );

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Irmão" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /adicionar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ displayName: "Irmão" });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("bloqueia envio com nome vazio", async () => {
    renderWithProviders(<AddParticipantForm contractId="c1" onDone={vi.fn()} />);
    fireEvent.submit(screen.getByRole("button", { name: /adicionar/i }));
    await waitFor(() =>
      expect(screen.getByText(/informe um nome/i)).toBeInTheDocument()
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test add-participant-form`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar `apps/web/src/components/add-participant-form.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AddParticipantInput,
  addParticipantSchema,
  INVITABLE_PARTICIPANT_ROLES,
} from "@quitto/shared";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddParticipantMutation } from "@/hooks/use-participant-mutations";
import { ROLE_LABEL } from "@/lib/labels";

/** Inline form to add a participant slot (name + role). */
export function AddParticipantForm({
  contractId,
  onDone,
}: {
  contractId: string;
  onDone: () => void;
}) {
  const addMutation = useAddParticipantMutation(contractId);
  const form = useForm<AddParticipantInput>({
    resolver: zodResolver(addParticipantSchema),
    defaultValues: { role: INVITABLE_PARTICIPANT_ROLES[0] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await addMutation.mutateAsync(values);
    form.reset();
    onDone();
  });

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-name">Nome</Label>
        <Input
          id="participant-name"
          placeholder="Ex.: Irmão"
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.displayName.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-role">Papel</Label>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          id="participant-role"
          {...form.register("role")}
        >
          {INVITABLE_PARTICIPANT_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={addMutation.isPending}
          type="submit"
        >
          {addMutation.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button onClick={onDone} type="button" variant="outline">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test add-participant-form`
Expected: PASS.

```bash
git add apps/web/src/components/add-participant-form.tsx apps/web/tests/add-participant-form.test.tsx
git commit -m "feat(web): AddParticipantForm (RHF+Zod, papéis de @quitto/shared)"
```

---

## Task 6: Web — `ParticipantsDrawer`

**Files:**
- Create: `apps/web/src/components/participants-drawer.tsx`
- Test: `apps/web/tests/participants-drawer.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/participants-drawer.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const createInvite = vi.fn().mockResolvedValue({
  token: "tok123",
  expiresAt: "2026-07-01T00:00:00.000Z",
});
const removeParticipant = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateInviteMutation: () => ({ mutateAsync: createInvite, isPending: false }),
  useRemoveParticipantMutation: () => ({
    mutateAsync: removeParticipant,
    isPending: false,
  }),
}));

import { ParticipantsDrawer } from "../src/components/participants-drawer";

const participants = [
  { id: "p1", displayName: "Maria", role: "seller", linked: false },
];

describe("ParticipantsDrawer", () => {
  beforeEach(() => {
    createInvite.mockClear();
    removeParticipant.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("gera o link de convite para um slot não-vinculado", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /convidar/i }));
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar link/i }));

    await waitFor(() => expect(createInvite).toHaveBeenCalled());
    expect(createInvite.mock.calls[0][0]).toMatchObject({
      participantId: "p1",
      body: { email: "maria@example.com" },
    });
    await waitFor(() =>
      expect(screen.getByDisplayValue(/\/invites\/tok123$/)).toBeInTheDocument()
    );
  });

  it("remove participante após confirmação", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /remover/i }));
    // confirm dialog
    fireEvent.click(screen.getByRole("button", { name: /^remover$/i }));
    await waitFor(() => expect(removeParticipant).toHaveBeenCalledWith("p1"));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test participants-drawer`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar `apps/web/src/components/participants-drawer.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateInviteInput,
  createInviteSchema,
  PARTICIPANT_ROLE,
} from "@quitto/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AddParticipantForm } from "@/components/add-participant-form";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  useCreateInviteMutation,
  useRemoveParticipantMutation,
} from "@/hooks/use-participant-mutations";
import { ROLE_LABEL } from "@/lib/labels";

interface ParticipantView {
  id: string;
  displayName: string;
  role: string;
  linked: boolean;
}

function InvitePanel({
  contractId,
  participantId,
}: {
  contractId: string;
  participantId: string;
}) {
  const createInvite = useCreateInviteMutation(contractId);
  const [token, setToken] = useState<string | null>(null);
  const form = useForm<CreateInviteInput>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createInvite.mutateAsync({ participantId, body: values });
    setToken(res.token);
  });

  if (token) {
    const link = `${window.location.origin}/invites/${token}`;
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
        <Label htmlFor={`link-${participantId}`}>Link do convite</Label>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            id={`link-${participantId}`}
            readOnly
            value={link}
          />
          <CopyButton value={link} />
        </div>
        <p className="text-muted-foreground text-xs">
          Este link expira em 7 dias e só funciona para esse e-mail.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3"
      onSubmit={onSubmit}
    >
      <Label htmlFor={`email-${participantId}`}>E-mail do convidado</Label>
      <Input
        id={`email-${participantId}`}
        placeholder="pessoa@exemplo.com"
        type="email"
        {...form.register("email")}
      />
      {form.formState.errors.email ? (
        <p className="text-destructive text-xs">
          {form.formState.errors.email.message}
        </p>
      ) : null}
      <Button disabled={createInvite.isPending} type="submit">
        {createInvite.isPending ? "Gerando…" : "Gerar link"}
      </Button>
    </form>
  );
}

function ParticipantItem({
  contractId,
  participant,
}: {
  contractId: string;
  participant: ParticipantView;
}) {
  const removeMutation = useRemoveParticipantMutation(contractId);
  const [inviting, setInviting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isOwner = participant.role === PARTICIPANT_ROLE.owner;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${participant.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
        <span className="font-medium text-foreground text-sm">
          {participant.displayName}
        </span>
        <Badge tone="neutral">
          {ROLE_LABEL[participant.role] ?? participant.role}
        </Badge>
        <div className="ml-auto flex gap-1">
          {participant.linked || isOwner ? null : (
            <Button
              onClick={() => setInviting((v) => !v)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Convidar
            </Button>
          )}
          {isOwner ? null : (
            <Button
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remover
            </Button>
          )}
        </div>
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
}

/** Owner-only drawer to manage participants and generate invite links. */
export function ParticipantsDrawer({
  contractId,
  participants,
  open,
  onClose,
}: {
  contractId: string;
  participants: ParticipantView[];
  open: boolean;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Sheet onOpenChange={(o) => !o && onClose()} open={open}>
      <SheetContent title="Participantes">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <ul className="flex flex-col gap-2">
            {participants.map((p) => (
              <ParticipantItem
                contractId={contractId}
                key={p.id}
                participant={p}
              />
            ))}
          </ul>

          {adding ? (
            <AddParticipantForm
              contractId={contractId}
              onDone={() => setAdding(false)}
            />
          ) : (
            <Button
              onClick={() => setAdding(true)}
              type="button"
              variant="outline"
            >
              + Adicionar participante
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

> **Nota:** `Button` aceita `size="sm"` e `variant` (`ghost`/`outline`/`destructive`) — confirmado em `apps/web/src/components/ui/button.tsx`.

- [ ] **Step 4: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test participants-drawer`
Expected: PASS.

```bash
git add apps/web/src/components/participants-drawer.tsx apps/web/tests/participants-drawer.test.tsx
git commit -m "feat(web): ParticipantsDrawer (gerir slots + gerar link, remover com confirm)"
```

---

## Task 7: Web — botão "Gerenciar" + drawer na tela do contrato

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Test: `apps/web/tests/contract-detail.test.tsx`

- [ ] **Step 1: Ajustar o teste existente** — em `apps/web/tests/contract-detail.test.tsx`, adicione um caso que verifica o botão "Gerenciar" para owner. O mock `detail` já tem `role: "owner"`. Acrescente ao `describe`:

```tsx
  it("mostra o botão Gerenciar para o dono", () => {
    useContractQuery.mockReturnValue({ data: detail, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    expect(
      screen.getByRole("button", { name: /gerenciar/i })
    ).toBeInTheDocument();
  });

  it("não mostra Gerenciar para não-dono", () => {
    useContractQuery.mockReturnValue({
      data: { ...detail, role: "viewer" },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    expect(
      screen.queryByRole("button", { name: /gerenciar/i })
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test contract-detail`
Expected: FAIL (botão ainda não existe).

- [ ] **Step 3: Editar `apps/web/src/routes/contract-detail.tsx`**

No topo, adicione os imports:

```tsx
import { PARTICIPANT_ROLE } from "@quitto/shared";
import { Button } from "@/components/ui/button";
import { ParticipantsDrawer } from "@/components/participants-drawer";
```

Dentro de `ContractDetailPage`, junto do `useState` existente, acrescente:

```tsx
  const [managing, setManaging] = useState(false);
  const isOwner = data.role === PARTICIPANT_ROLE.owner;
```

> `data.role` só existe após o early-return de loading; declare `isOwner`/`managing` depois do `const { contract, progress, installments, participants } = data;`. Mantenha o `const [openId, setOpenId] = useState<string | null>(null);` no topo (antes do early-return) e mova o `managing` para junto dele (hooks não podem ficar após return condicional). **Correto:** declare `const [managing, setManaging] = useState(false);` ao lado de `openId` no topo, e `const isOwner = data.role === PARTICIPANT_ROLE.owner;` após o destructuring de `data`.

No cabeçalho da seção "Participantes", troque o `<h2>` simples por um header com o botão (apenas para owner):

```tsx
      <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Participantes
          </h2>
          {isOwner ? (
            <Button
              onClick={() => setManaging(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Gerenciar
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {/* ...lista read-only existente, inalterada... */}
        </ul>
      </section>
```

Antes do fechamento do componente (junto do `<InstallmentDrawer ... />`), monte o drawer (só para owner):

```tsx
      {isOwner ? (
        <ParticipantsDrawer
          contractId={contract.id}
          onClose={() => setManaging(false)}
          open={managing}
          participants={participants}
        />
      ) : null}
```

> `Button` aceita `size="sm"` (confirmado). Mantenha a lista read-only existente intacta.

- [ ] **Step 4: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test contract-detail`
Expected: PASS.

```bash
git add apps/web/src/routes/contract-detail.tsx apps/web/tests/contract-detail.test.tsx
git commit -m "feat(web): botão Gerenciar + ParticipantsDrawer na tela do contrato (owner)"
```

---

## Task 8: Web — tela de aceitar convite + rota + login redirect round-trip

**Files:**
- Create: `apps/web/src/routes/accept-invite.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/routes/protected.tsx`
- Modify: `apps/web/src/routes/login.tsx`
- Test: `apps/web/tests/accept-invite.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/accept-invite.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const useInviteQuery = vi.fn();
const acceptMutate = vi.fn().mockResolvedValue({ contractId: "c1" });
const navigate = vi.fn();
vi.mock("../src/hooks/use-invite", () => ({
  useInviteQuery: () => useInviteQuery(),
  useAcceptInviteMutation: () => ({ mutateAsync: acceptMutate, isPending: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ token: "tok1" }),
  useNavigate: () => navigate,
}));

import { AcceptInvitePage } from "../src/routes/accept-invite";

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    useInviteQuery.mockReset();
    acceptMutate.mockClear();
    navigate.mockClear();
  });

  it("aceita quando o e-mail bate e navega ao contrato", async () => {
    useInviteQuery.mockReturnValue({
      data: { contractTitle: "Apê", role: "seller", email: "a@b.com", emailMatches: true },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);

    fireEvent.click(screen.getByRole("button", { name: /aceitar/i }));
    await waitFor(() => expect(acceptMutate).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/contracts/$id",
        params: { id: "c1" },
      })
    );
  });

  it("desabilita aceitar quando o e-mail não bate", () => {
    useInviteQuery.mockReturnValue({
      data: { contractTitle: "Apê", role: "seller", email: "outro@b.com", emailMatches: false },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);
    expect(screen.getByText(/outro e-mail/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aceitar/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test accept-invite`
Expected: FAIL (página não existe).

- [ ] **Step 3: Implementar `apps/web/src/routes/accept-invite.tsx`**

```tsx
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcceptInviteMutation,
  useInviteQuery,
} from "@/hooks/use-invite";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/error-message";
import { ROLE_LABEL } from "@/lib/labels";

export function AcceptInvitePage() {
  const { token } = useParams({ from: "/protected/invites/$token" });
  const navigate = useNavigate();
  const { data, isPending, error } = useInviteQuery(token);
  const acceptMutation = useAcceptInviteMutation(token);

  if (isPending) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="font-bold font-display text-xl text-foreground">
          Convite indisponível
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {errorMessage(error)}
        </p>
      </div>
    );
  }

  async function onAccept() {
    const res = await acceptMutation.mutateAsync();
    navigate({ to: "/contracts/$id", params: { id: res.contractId } });
  }

  async function onSwitchAccount() {
    await authClient.signOut();
    window.location.href = `/login?redirect=${encodeURIComponent(`/invites/${token}`)}`;
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
        Convite para um contrato
      </h1>
      <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <p className="text-foreground">
          Você foi convidado para <strong>{data.contractTitle}</strong> como{" "}
          <strong>{ROLE_LABEL[data.role] ?? data.role}</strong>.
        </p>

        {data.emailMatches ? (
          <Button
            className="mt-4 w-full"
            disabled={acceptMutation.isPending}
            onClick={onAccept}
            type="button"
          >
            {acceptMutation.isPending ? "Aceitando…" : "Aceitar convite"}
          </Button>
        ) : (
          <div className="mt-4">
            <p className="text-muted-foreground text-sm">
              Este convite é para outro e-mail ({data.email}). Entre com a conta
              correta para aceitar.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={onSwitchAccount}
              type="button"
              variant="outline"
            >
              Entrar com outra conta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Registrar a rota em `apps/web/src/router.tsx`**

Adicione o import:

```tsx
import { AcceptInvitePage } from "./routes/accept-invite";
```

Defina a rota (sob `protectedRoute`):

```tsx
const acceptInviteRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/invites/$token",
  component: AcceptInvitePage,
});
```

E inclua-a nos filhos de `protectedRoute`:

```tsx
  protectedRoute.addChildren([
    dashboardRoute,
    contractsListRoute,
    contractNewRoute,
    contractDetailRoute,
    acceptInviteRoute,
  ]),
```

- [ ] **Step 5: Login redirect round-trip** — em `apps/web/src/routes/protected.tsx`, troque o `beforeLoad` para capturar o destino:

```tsx
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
```

Em `apps/web/src/router.tsx`, dê ao `loginRoute` um `validateSearch` que lê `redirect`:

```tsx
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});
```

Em `apps/web/src/routes/login.tsx`, leia o destino e use-o (apenas caminhos internos, para evitar open-redirect). Adicione o import e a leitura do search no topo do componente:

```tsx
import { useSearch } from "@tanstack/react-router";
```
```tsx
  const search = useSearch({ strict: false }) as { redirect?: string };
  const target =
    search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
      ? search.redirect
      : "/";
```

Troque os literais `"/"` pelos usos de `target`: nos `callbackURL` (signIn/signUp e Google) e no `window.location.href = "/"` → `window.location.href = target`.

- [ ] **Step 6: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test accept-invite`
Expected: PASS.
Run: `bun --filter @quitto/web typecheck`
Expected: exit 0.

```bash
git add apps/web/src/routes/accept-invite.tsx apps/web/src/router.tsx apps/web/src/routes/protected.tsx apps/web/src/routes/login.tsx apps/web/tests/accept-invite.test.tsx
git commit -m "feat(web): tela de aceitar convite + rota /invites/\$token + login redirect round-trip"
```

---

## Task 9: Web — banner de descoberta de convites

**Files:**
- Create: `apps/web/src/components/pending-invites-banner.tsx`
- Modify: `apps/web/src/routes/contracts-list.tsx`
- Test: `apps/web/tests/pending-invites-banner.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/pending-invites-banner.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const useMyInvitesQuery = vi.fn();
vi.mock("../src/hooks/use-my-invites", () => ({
  useMyInvitesQuery: () => useMyInvitesQuery(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { PendingInvitesBanner } from "../src/components/pending-invites-banner";

describe("PendingInvitesBanner", () => {
  beforeEach(() => useMyInvitesQuery.mockReset());

  it("mostra a contagem quando há convites", () => {
    useMyInvitesQuery.mockReturnValue({
      data: [
        { token: "t1", contractTitle: "Apê", role: "seller", expiresAt: "2026-07-01T00:00:00.000Z" },
      ],
    });
    renderWithProviders(<PendingInvitesBanner />);
    expect(screen.getByText(/1 convite/i)).toBeInTheDocument();
    expect(screen.getByText("Apê")).toBeInTheDocument();
  });

  it("não renderiza nada sem convites", () => {
    useMyInvitesQuery.mockReturnValue({ data: [] });
    const { container } = renderWithProviders(<PendingInvitesBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test pending-invites-banner`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implementar `apps/web/src/components/pending-invites-banner.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { useMyInvitesQuery } from "@/hooks/use-my-invites";
import { ROLE_LABEL } from "@/lib/labels";

/** Self-contained banner: surfaces pending invites for the session email. */
export function PendingInvitesBanner() {
  const { data } = useMyInvitesQuery();
  const invites = data ?? [];

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="font-display font-semibold text-foreground text-sm">
        Você tem {invites.length} convite
        {invites.length > 1 ? "s" : ""} pendente
        {invites.length > 1 ? "s" : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {invites.map((inv) => (
          <li className="flex items-center gap-2 text-sm" key={inv.token}>
            <span className="font-medium text-foreground">
              {inv.contractTitle}
            </span>
            <span className="text-muted-foreground text-xs">
              {ROLE_LABEL[inv.role] ?? inv.role}
            </span>
            <Link
              className="ml-auto text-primary text-sm underline"
              params={{ token: inv.token }}
              to="/invites/$token"
            >
              Ver convite
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Inserir o banner em `apps/web/src/routes/contracts-list.tsx`**

Adicione o import e renderize o banner no topo do conteúdo (logo após a `<div>` do header, antes do `<ContractsListBody/>`):

```tsx
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
```
```tsx
      <PendingInvitesBanner />
      <ContractsListBody data={data} isPending={isPending} />
```

- [ ] **Step 5: Rodar e ver passar + commit**

Run: `bun --filter @quitto/web test pending-invites-banner`
Expected: PASS.

```bash
git add apps/web/src/components/pending-invites-banner.tsx apps/web/src/routes/contracts-list.tsx apps/web/tests/pending-invites-banner.test.tsx
git commit -m "feat(web): banner de convites pendentes na lista de contratos"
```

---

## Task 10: Web — `actorName` na timeline + centralizar labels

**Files:**
- Modify: `apps/web/src/lib/labels.ts`
- Modify: `apps/web/src/components/audit-timeline.tsx`
- Test: `apps/web/tests/audit-timeline.test.tsx`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/audit-timeline.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTimeline } from "../src/components/audit-timeline";
import { renderWithProviders } from "./test-utils";

describe("AuditTimeline", () => {
  it("renderiza o rótulo do evento e o nome do ator", () => {
    renderWithProviders(
      <AuditTimeline
        events={[
          {
            id: "e1",
            type: "proof_submitted",
            actorName: "João",
            actorUserId: "u1",
            metadata: null,
            createdAt: "2026-06-10T12:00:00.000Z",
          },
        ]}
      />
    );
    expect(screen.getByText("Comprovante enviado")).toBeInTheDocument();
    expect(screen.getByText(/João/)).toBeInTheDocument();
  });

  it("omite o ator quando não há nome", () => {
    renderWithProviders(
      <AuditTimeline
        events={[
          {
            id: "e2",
            type: "installment_paid",
            actorName: null,
            actorUserId: null,
            metadata: null,
            createdAt: "2026-06-10T12:00:00.000Z",
          },
        ]}
      />
    );
    expect(screen.getByText("Parcela paga")).toBeInTheDocument();
    expect(screen.queryByText(/por /)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test audit-timeline`
Expected: FAIL (`actorName` não está no tipo nem renderizado).

- [ ] **Step 3: Adicionar `AUDIT_TYPE_LABEL` em `apps/web/src/lib/labels.ts`**

No import do topo, inclua `AUDIT_TYPE` (já vem de `@quitto/shared`):

```ts
import {
  AUDIT_TYPE,
  CONTRACT_STATUS,
  type ContractStatus,
  INSTALLMENT_STATUS,
  type InstallmentStatus,
  OWNER_ROLE,
  PARTICIPANT_ROLE,
} from "@quitto/shared";
```

Ao fim do arquivo:

```ts
export const AUDIT_TYPE_LABEL: Record<string, string> = {
  [AUDIT_TYPE.proofSubmitted]: "Comprovante enviado",
  [AUDIT_TYPE.paymentConfirmed]: "Pagamento confirmado",
  [AUDIT_TYPE.paymentDisputed]: "Pagamento contestado",
  [AUDIT_TYPE.installmentPaid]: "Parcela paga",
};
```

- [ ] **Step 4: Editar `apps/web/src/components/audit-timeline.tsx`**

Acrescente `actorName` ao tipo, remova o `EVENT_LABELS` local (passa a usar `AUDIT_TYPE_LABEL`), e renderize o ator:

```tsx
import { AUDIT_TYPE_LABEL } from "@/lib/labels";

export interface AuditEventView {
  actorName: string | null;
  actorUserId: string | null;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown> | null;
  type: string;
}
```

(Remova a constante `EVENT_LABELS`.) No corpo do `map`, troque a linha do rótulo:

```tsx
              <span className="text-foreground text-sm">
                {AUDIT_TYPE_LABEL[e.type] ?? e.type}
                {e.actorName ? (
                  <span className="text-muted-foreground"> · por {e.actorName}</span>
                ) : null}
              </span>
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter @quitto/web test audit-timeline`
Expected: PASS.

- [ ] **Step 6: Typecheck (o `events` do drawer já carrega `actorName` da 4a)**

Run: `bun --filter @quitto/web typecheck`
Expected: exit 0. (O `InstallmentDrawer` passa `detail.events` — já tipado com `actorName` pela 4a — para `AuditTimeline`; o tipo agora bate.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/labels.ts apps/web/src/components/audit-timeline.tsx apps/web/tests/audit-timeline.test.tsx
git commit -m "feat(web): nome do ator na timeline + AUDIT_TYPE_LABEL centralizado"
```

---

## Task 11: Fechar — suite, Eden, build e merge

- [ ] **Step 1: Suite + lint + typecheck + build**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde (API e Web).

- [ ] **Step 2: Eden tipa os novos endpoints**

Run: `bun --filter @quitto/web test eden`
Expected: PASS (inclui `api.api.invites.mine.get`).

- [ ] **Step 3: Merge + roadmap**

Edite `docs/superpowers/ROADMAP.md`: na linha **4b**, troque "a escrever" pelo caminho do plano + ✅ **concluído** (merge em `develop`; suite verde).

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca a Fase 4b como concluída"
git checkout develop
git merge --no-ff feat/fase-4b-participantes-ui -m "Merge da Fase 4b (participantes/convites UI) em develop"
```

---

## Self-Review (cobertura do spec)

- **Backend `GET /api/invites/mine` (pendentes, escopo por e-mail, exclui aceitos/expirados):** Task 1 ✅
- **Schemas de form em `@quitto/shared` (sem literais):** Task 2 ✅
- **Hooks de dados (mutações + invalidação; query keys):** Task 3 ✅
- **Drawer de gestão (adicionar/convidar/link copiável/remover-com-confirm):** Tasks 4, 5, 6 ✅
- **Entrada "Gerenciar" só para owner, leitura inline preservada:** Task 7 ✅
- **Tela de aceitar (`/invites/$token`): match → aceita → navega; não-match → desabilita + trocar conta; erros:** Task 8 ✅
- **Login redirect round-trip (convidado deslogado volta ao convite; sem open-redirect):** Task 8 ✅
- **Banner de descoberta (autocontido, na lista de contratos):** Task 9 ✅
- **`actorName` na timeline + `AUDIT_TYPE_LABEL` centralizado:** Task 10 ✅
- **Eden tipa `invites.mine`; suite/lint/typecheck/build verdes; merge + roadmap:** Tasks 1, 11 ✅

> **Fora de escopo (confirmado no design):** envio de e-mail do convite (Fase 5), sininho/central de notificações (Fase 5), estado "pendente" por slot do lado do dono, revogar convite (`DELETE`).
