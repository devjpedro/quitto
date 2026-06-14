# Fase 7f — Excluir / sair de contrato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao dono a ação de excluir um contrato (hard delete + purga R2) e a participantes não-donos a ação de sair de um contrato.

**Architecture:** API: dois endpoints em `contracts.ts` — `DELETE /api/contracts/:id` (owner-only, coleta chaves R2 → deleta o contrato com cascata → purga R2 best-effort, espelhando `account.ts`) e `DELETE /api/contracts/:id/me` (participante não-dono apaga o próprio slot). Web: dois hooks de mutation + um componente `ContractActionsMenu` (dropdown + confirmação) no header do detalhe; a navegação para a lista fica no componente; toda escrita passa por `invalidateContractViews`.

**Tech Stack:** Elysia + Drizzle + Postgres (bun:test), Eden treaty, React 19 + TanStack Router/Query v5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-14-fase-7f-excluir-sair-contrato-design.md`

**Git:** branch `feat/fase-7f-excluir-sair-contrato` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 7f no ROADMAP.

**Convenções:** código em inglês; sem literais espalhados; RBAC sem vazar (404 para stranger via `getContractRole`).

**Decisão de rota (leave):** o endpoint de saída é `DELETE /api/contracts/:id/me` (não `/participants/me`) — segmento estático `me` sob `:id`, sem colisão com o parâmetro `:participantId` e com treaty limpo `contracts({ id }).me.delete()`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/contracts.ts` (mod) | `DELETE /contracts/:id` + `DELETE /contracts/:id/me` |
| `apps/api/tests/contract-lifecycle.test.ts` (criar) | testes dos dois endpoints |
| `apps/web/src/hooks/use-contract-mutations.ts` (mod) | `useDeleteContractMutation`, `useLeaveContractMutation` |
| `apps/web/src/components/contract-actions-menu.tsx` (criar) | dropdown + confirmação no header |
| `apps/web/src/routes/contract-detail.tsx` (mod) | renderiza o menu no header |
| `apps/web/tests/contract-lifecycle.test.tsx` (criar) | invalidação dos hooks |
| `apps/web/tests/contract-actions-menu.test.tsx` (criar) | menu por papel + fluxo de confirmação |

---

## Task 1: API — excluir contrato + sair do contrato

**Files:**
- Modify: `apps/api/src/modules/contracts.ts`
- Test: `apps/api/tests/contract-lifecycle.test.ts`

- [ ] **Step 1: Teste que falha**

Crie `apps/api/tests/contract-lifecycle.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function signUp(email: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email, password: "password123" }),
    })
  );
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("sign-up did not return a set-cookie header");
  }
  const [cookie] = setCookie.split(";");
  if (!cookie) {
    throw new Error("could not parse session cookie");
  }
  return cookie;
}

let seq = 0;
function uniqueEmail(tag: string): string {
  seq += 1;
  return `${tag}-${Date.now()}-${seq}@example.com`;
}

async function createContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato Teste",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  const body = await res.json();
  return body.id as string;
}

/** Adds a seller slot, invites `email`, signs that user up and accepts → returns the linked member's cookie. */
async function joinAsMember(
  ownerCookie: string,
  contractId: string
): Promise<string> {
  const email = uniqueEmail("member");
  const addRes = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ displayName: "Membro", role: "seller" }),
    })
  );
  const { id: participantId } = await addRes.json();
  const invRes = await app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ email }),
      }
    )
  );
  const { token } = await invRes.json();
  const memberCookie = await signUp(email);
  const acc = await app.handle(
    new Request(`http://localhost/api/invites/${token}/accept`, {
      method: "POST",
      headers: { cookie: memberCookie },
    })
  );
  expect(acc.status).toBe(200);
  return memberCookie;
}

function del(path: string, cookie?: string) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : undefined,
    })
  );
}

function getContract(contractId: string, cookie: string) {
  return app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
}

describe("DELETE /api/contracts/:id", () => {
  it("owner exclui o contrato (some para todos)", async () => {
    const owner = await signUp(uniqueEmail("del-owner"));
    const contractId = await createContract(owner);

    const res = await del(`/api/contracts/${contractId}`, owner);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect((await getContract(contractId, owner)).status).toBe(404);
  });

  it("participante não-dono recebe 403", async () => {
    const owner = await signUp(uniqueEmail("del-fo"));
    const contractId = await createContract(owner);
    const member = await joinAsMember(owner, contractId);

    expect((await del(`/api/contracts/${contractId}`, member)).status).toBe(403);
    // o contrato continua acessível ao dono
    expect((await getContract(contractId, owner)).status).toBe(200);
  });

  it("estranho recebe 404 (não vaza)", async () => {
    const owner = await signUp(uniqueEmail("del-leak-o"));
    const contractId = await createContract(owner);
    const stranger = await signUp(uniqueEmail("del-leak-s"));

    expect((await del(`/api/contracts/${contractId}`, stranger)).status).toBe(404);
  });

  it("não autenticado recebe 401", async () => {
    const owner = await signUp(uniqueEmail("del-unauth"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}`)).status).toBe(401);
  });
});

describe("DELETE /api/contracts/:id/me (sair)", () => {
  it("participante não-dono sai e perde o acesso", async () => {
    const owner = await signUp(uniqueEmail("leave-o"));
    const contractId = await createContract(owner);
    const member = await joinAsMember(owner, contractId);

    expect((await getContract(contractId, member)).status).toBe(200);

    const res = await del(`/api/contracts/${contractId}/me`, member);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // saiu → não acessa mais; o contrato segue de pé para o dono
    expect((await getContract(contractId, member)).status).toBe(404);
    expect((await getContract(contractId, owner)).status).toBe(200);
  });

  it("dono não pode sair (use excluir) → 403", async () => {
    const owner = await signUp(uniqueEmail("leave-owner"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}/me`, owner)).status).toBe(403);
  });

  it("estranho recebe 404 (não vaza)", async () => {
    const owner = await signUp(uniqueEmail("leave-leak-o"));
    const contractId = await createContract(owner);
    const stranger = await signUp(uniqueEmail("leave-leak-s"));

    expect((await del(`/api/contracts/${contractId}/me`, stranger)).status).toBe(404);
  });

  it("não autenticado recebe 401", async () => {
    const owner = await signUp(uniqueEmail("leave-unauth"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}/me`)).status).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/contract-lifecycle.test.ts`
Expected: FAIL (endpoints ainda não existem — DELETE devolve 404/405).

- [ ] **Step 3: Implementar os dois endpoints**

Em `apps/api/src/modules/contracts.ts`:

3a. Acrescente `proof` ao import do schema e importe `deleteObjects`. Troque:
```ts
import { contract, installment, participant } from "../db/schema";
```
por:
```ts
import { contract, installment, participant, proof } from "../db/schema";
```
e adicione (junto aos outros imports de `../lib/...`):
```ts
import { deleteObjects } from "../lib/storage";
```

3b. Encadeie os dois handlers no `contractsModule` (depois do `.patch(...)` de installments, antes do `;` final):

```ts
  .delete(
    "/contracts/:id",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id); // 404 se sem acesso
      if (!isOwner) {
        throw new ForbiddenError("Apenas o dono exclui o contrato");
      }

      // chaves R2 dos comprovantes antes da cascata
      const keys = await db
        .select({ objectKey: proof.objectKey })
        .from(proof)
        .innerJoin(installment, eq(proof.installmentId, installment.id))
        .where(eq(installment.contractId, params.id));

      await db.delete(contract).where(eq(contract.id, params.id)); // cascata cuida do resto

      try {
        await deleteObjects(keys.map((k) => k.objectKey));
      } catch (err) {
        // best-effort: objeto órfão no R2 é vazamento menor, não erro de exclusão
        console.error("[delete-contract] falha ao purgar R2", err);
      }

      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  )
  .delete(
    "/contracts/:id/me",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id); // 404 se sem acesso
      if (isOwner) {
        throw new ForbiddenError("O dono não pode sair; exclua o contrato");
      }
      await db
        .delete(participant)
        .where(
          and(
            eq(participant.contractId, params.id),
            eq(participant.linkedUserId, user.id)
          )
        );
      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  );
```

(`and`, `eq`, `db`, `requireAuth`, `getContractRole`, `ForbiddenError` já estão importados no arquivo.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/contract-lifecycle.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Não regrediu**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/modules/contracts.ts apps/api/tests/contract-lifecycle.test.ts
git commit -m "feat(api): excluir contrato (owner, cascata+R2) e sair do contrato (não-dono)"
```

> Nota: a verificação de QUAIS chaves R2 são purgadas (com proof real) fica de fora, igual ao `DELETE /api/me` da 6c (mesmo follow-up em aberto). O fluxo de purga espelha o handler já provado em `account.ts`.

---

## Task 2: Web — mutations de excluir e sair

**Files:**
- Modify: `apps/web/src/hooks/use-contract-mutations.ts`
- Test: `apps/web/tests/contract-lifecycle.test.tsx`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/contract-lifecycle.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    me: {
      delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    },
  });
  return { api: { api: { contracts } } };
});

import {
  useDeleteContractMutation,
  useLeaveContractMutation,
} from "../src/hooks/use-contract-mutations";

function wrap(client: ReturnType<typeof makeTestQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("contract lifecycle mutations", () => {
  it("deleteContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteContractMutation(), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync("c1");
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });

  it("leaveContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLeaveContractMutation("c1"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-lifecycle.test.tsx`
Expected: FAIL ("useDeleteContractMutation is not a function" / export ausente).

- [ ] **Step 3: Implementar os hooks**

Em `apps/web/src/hooks/use-contract-mutations.ts`, acrescente ao final (mantendo os imports existentes — `api`, `unwrap`, `invalidateContractViews`, `useMutation`, `useQueryClient` já estão lá):

```ts
export function useDeleteContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) =>
      unwrap(api.api.contracts({ id: contractId }).delete()),
    onSuccess: () => invalidateContractViews(qc),
  });
}

export function useLeaveContractMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.contracts({ id: contractId }).me.delete()),
    onSuccess: () => invalidateContractViews(qc),
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-lifecycle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/hooks/use-contract-mutations.ts apps/web/tests/contract-lifecycle.test.tsx
git commit -m "feat(web): mutations de excluir e sair de contrato (invalida views)"
```

---

## Task 3: Web — menu de ações no detalhe do contrato

**Files:**
- Create: `apps/web/src/components/contract-actions-menu.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Test: `apps/web/tests/contract-actions-menu.test.tsx`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/contract-actions-menu.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const deleteAsync = vi.fn().mockResolvedValue({ ok: true });
const leaveAsync = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useDeleteContractMutation: () => ({
    mutateAsync: deleteAsync,
    isPending: false,
  }),
  useLeaveContractMutation: () => ({
    mutateAsync: leaveAsync,
    isPending: false,
  }),
}));

import { ContractActionsMenu } from "../src/components/contract-actions-menu";

const MENU = /ações do contrato/i;
const DELETE_ITEM = /excluir contrato/i;
const LEAVE_ITEM = /sair do contrato/i;

describe("ContractActionsMenu", () => {
  beforeEach(() => {
    navigate.mockReset();
    deleteAsync.mockClear();
    leaveAsync.mockClear();
  });

  it("dono exclui o contrato e volta para a lista", async () => {
    renderWithProviders(<ContractActionsMenu contractId="c1" isOwner />);
    await userEvent.click(screen.getByRole("button", { name: MENU }));
    await userEvent.click(screen.getByRole("menuitem", { name: DELETE_ITEM }));
    // dialog de confirmação abre com o botão destrutivo
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^excluir$/i })
    );
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith("c1"));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/contracts" })
    );
    expect(leaveAsync).not.toHaveBeenCalled();
  });

  it("não-dono sai do contrato e volta para a lista", async () => {
    renderWithProviders(
      <ContractActionsMenu contractId="c1" isOwner={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: MENU }));
    await userEvent.click(screen.getByRole("menuitem", { name: LEAVE_ITEM }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^sair$/i })
    );
    await waitFor(() => expect(leaveAsync).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/contracts" })
    );
    expect(deleteAsync).not.toHaveBeenCalled();
  });
});
```

Adicione `within` ao import de `@testing-library/react` (linha 1):
```tsx
import { screen, waitFor, within } from "@testing-library/react";
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-actions-menu.test.tsx`
Expected: FAIL ("Cannot find module ../src/components/contract-actions-menu").

- [ ] **Step 3: Implementar o componente**

Crie `apps/web/src/components/contract-actions-menu.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { LogOut, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteContractMutation,
  useLeaveContractMutation,
} from "@/hooks/use-contract-mutations";

/** Owner deletes the contract; a non-owner participant leaves it. Both confirm first. */
export function ContractActionsMenu({
  contractId,
  isOwner,
}: {
  contractId: string;
  isOwner: boolean;
}) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteContractMutation();
  const leaveMutation = useLeaveContractMutation(contractId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = deleteMutation.isPending || leaveMutation.isPending;

  async function onConfirm() {
    if (isOwner) {
      await deleteMutation.mutateAsync(contractId);
    } else {
      await leaveMutation.mutateAsync();
    }
    setConfirmOpen(false);
    navigate({ to: "/contracts" });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Ações do contrato" asChild>
          <Button size="icon" type="button" variant="ghost">
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
            {isOwner ? (
              <>
                <Trash2 aria-hidden="true" />
                Excluir contrato
              </>
            ) : (
              <>
                <LogOut aria-hidden="true" />
                Sair do contrato
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description={
            isOwner
              ? "Excluir este contrato é permanente: parcelas, comprovantes e histórico serão apagados."
              : "Você deixará de ter acesso a este contrato."
          }
          title={isOwner ? "Excluir contrato" : "Sair do contrato"}
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {isOwner ? "Excluir" : "Sair"}
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
    </>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-actions-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Renderizar o menu no detalhe**

Em `apps/web/src/routes/contract-detail.tsx`:

5a. Adicione o import:
```tsx
import { ContractActionsMenu } from "@/components/contract-actions-menu";
```

5b. No header (linhas ~98-103), troque o bloco do título + ExportMenu por um que agrupe ExportMenu e o novo menu:
```tsx
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-bold font-display text-2xl text-foreground tracking-tight">
            {contract.title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <ExportMenu contractId={id} />
            <ContractActionsMenu contractId={id} isOwner={isOwner} />
          </div>
        </div>
```

- [ ] **Step 6: Não regrediu**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/contract-detail.test.tsx tests/contract-detail-deeplink.test.tsx`
Expected: PASS (o menu não dispara nada no render; mutations só rodam ao confirmar).

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/contract-actions-menu.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/contract-actions-menu.test.tsx
git commit -m "feat(web): menu de ações no detalhe (excluir/sair de contrato)"
```

---

## Task 4: Verificação final + merge + roadmap

- [ ] **Step 1: Suítes**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test`
Expected: verde.
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde.

- [ ] **Step 2: Typecheck + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes (confirma que o treaty Eden expõe `contracts({ id }).delete()` e `contracts({ id }).me.delete()`).

- [ ] **Step 3: Smoke manual (dev)**

Com `bun run dev`: como dono, abrir um contrato → menu ⋯ → "Excluir contrato" → confirmar → volta à lista e o contrato sumiu (dashboard também). Como participante não-dono (segunda conta vinculada por convite), abrir o contrato → menu ⋯ → "Sair do contrato" → confirmar → volta à lista sem o contrato; o dono ainda o vê.

- [ ] **Step 4: Marcar a 7f no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, marque a linha **7f** como concluída:
`` | **7f** | Excluir / sair de contrato | `DELETE /api/contracts/:id` (owner, cascata + purga R2 best-effort) e `DELETE /api/contracts/:id/me` (não-dono sai); menu de ações no detalhe com confirmação. | `plans/2026-06-14-fase-7f-excluir-sair-contrato.md` ✅ **concluído** (merge em `develop`; suites verdes) | ``
(Se a linha 7f ainda não existir, adicione-a junto às sub-fases da Fase 7.)

- [ ] **Step 5: Commit do roadmap + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 7f concluída"
git checkout develop
git merge --no-ff feat/fase-7f-excluir-sair-contrato -m "Merge: Fase 7f — excluir/sair de contrato"
```

Expected: merge limpo; suites verdes em `develop`.

---

## Notas para o executor

- **RBAC sem vazar:** `getContractRole` já lança 404 para quem não tem acesso. O dono que tenta sair e o participante que tenta excluir recebem **403** (eles já conhecem o contrato) — não 404.
- **Cascata:** o schema apaga installments/proofs/participants/audit/invites/notifications ao deletar o contrato; o handler só coleta as chaves R2 antes e purga depois (best-effort, nunca falha a exclusão).
- **Navegação fica no componente** (`ContractActionsMenu`), não no hook — espelha o padrão do wizard (`contract-new` navega após `mutateAsync`). Os hooks só mutam + invalidam.
- **Rota de saída:** `DELETE /api/contracts/:id/me` (estático), treaty `contracts({ id }).me.delete()`.
- **Sem soft delete, sem transferência de propriedade, sem bloqueio por atividade** (decisões fechadas no spec).
