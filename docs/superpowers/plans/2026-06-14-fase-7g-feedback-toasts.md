# Fase 7g — Feedback de sucesso (toasts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar feedback de sucesso ao usuário nas ações de escrita, via toast, espelhando o tratamento global de erro que já existe.

**Architecture:** Um `onSuccess` global no `MutationCache` lê `mutation.meta.successMessage` e dispara `toast.success`. Cada mutation opta declarando `meta: { successMessage: FEEDBACK.x }`. Mensagens centralizadas em `lib/feedback.ts`. Zero `toast` espalhado pelos hooks; simétrico ao `onError` já existente.

**Tech Stack:** React 19 + TanStack Query v5, sonner, Vitest. Web-only — **sem mudança de API**.

**Spec:** `docs/superpowers/specs/2026-06-14-fase-7g-feedback-toasts-design.md`

**Git:** branch `feat/fase-7g-feedback-toasts` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 7g no ROADMAP.

**Convenções:** código em inglês; mensagens pt-BR centralizadas em `FEEDBACK` (sem literais nos hooks); sem comentários óbvios.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/feedback.ts` (criar) | `FEEDBACK` (mensagens pt-BR) |
| `apps/web/src/lib/query.ts` (mod) | augmentation `mutationMeta` + `toastSuccessFromMeta` no `MutationCache.onSuccess` |
| `apps/web/src/hooks/use-payment-mutations.ts` (mod) | `meta` nos 4 |
| `apps/web/src/hooks/use-contract-mutations.ts` (mod) | `meta` nos 4 |
| `apps/web/src/hooks/use-participant-mutations.ts` (mod) | `meta` nos 4 |
| `apps/web/src/hooks/use-invite.ts` (mod) | `meta` no accept |
| `apps/web/tests/toast-success.test.ts` (criar) | handler |
| `apps/web/tests/feedback-toasts.test.tsx` (criar) | fiação ponta a ponta (representativa) |

---

## Task 1: Mensagens + handler global de toast de sucesso

**Files:**
- Create: `apps/web/src/lib/feedback.ts`
- Modify: `apps/web/src/lib/query.ts`
- Test: `apps/web/tests/toast-success.test.ts`

- [ ] **Step 1: Criar as mensagens**

Crie `apps/web/src/lib/feedback.ts`:

```ts
/** Mensagens de sucesso (pt-BR) disparadas via mutation.meta.successMessage. */
export const FEEDBACK = {
  proofSubmitted: "Comprovante enviado",
  paymentConfirmed: "Pagamento confirmado",
  paymentDisputed: "Pagamento contestado",
  installmentPaid: "Parcela marcada como paga",
  contractCreated: "Contrato criado",
  installmentUpdated: "Parcela atualizada",
  participantAdded: "Participante adicionado",
  participantRemoved: "Participante removido",
  roleUpdated: "Papel atualizado",
  inviteCreated: "Convite gerado",
  inviteAccepted: "Convite aceito",
  contractDeleted: "Contrato excluído",
  contractLeft: "Você saiu do contrato",
} as const;
```

- [ ] **Step 2: Escrever o teste do handler que falha**

Crie `apps/web/tests/toast-success.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const success = vi.fn();
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));

import { toastSuccessFromMeta } from "../src/lib/query";

describe("toastSuccessFromMeta", () => {
  it("toasts the meta.successMessage on success", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, {
      meta: { successMessage: "Feito" },
    } as never);
    expect(success).toHaveBeenCalledWith("Feito");
  });

  it("does nothing when there is no successMessage", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, { meta: undefined } as never);
    expect(success).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/toast-success.test.ts`
Expected: FAIL (`toastSuccessFromMeta` não exportado).

- [ ] **Step 4: Implementar em `query.ts`**

Em `apps/web/src/lib/query.ts`:

1. importe o tipo `Mutation`:
```ts
import { type Mutation, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
```

2. tipe o `meta` (augmentation, no fim do arquivo ou logo após os imports):
```ts
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { successMessage?: string };
  }
}
```

3. adicione o handler exportado (acima da criação do `queryClient`):
```ts
/** Dispara toast.success quando a mutation declara meta.successMessage. */
export function toastSuccessFromMeta(
  _data: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
): void {
  const message = mutation.meta?.successMessage;
  if (typeof message === "string" && message.length > 0) {
    toast.success(message);
  }
}
```

4. ligue no `MutationCache` (mantendo o `onError` atual):
```ts
mutationCache: new MutationCache({
  onSuccess: toastSuccessFromMeta,
  onError: (error) => {
    if (shouldToast(error)) {
      toast.error(errorMessage(error));
    }
  },
}),
```

- [ ] **Step 5: Rodar e ver passar + typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/toast-success.test.ts`
Expected: PASS.
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS (o `meta` tipado).

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/feedback.ts apps/web/src/lib/query.ts apps/web/tests/toast-success.test.ts
git commit -m "feat(web): toast de sucesso global via mutation.meta.successMessage"
```

---

## Task 2: Declarar `meta` em todas as mutations

**Files:**
- Modify: `use-payment-mutations.ts`, `use-contract-mutations.ts`, `use-participant-mutations.ts`, `use-invite.ts`
- Test: `apps/web/tests/feedback-toasts.test.tsx`

Em cada hook, importe `import { FEEDBACK } from "@/lib/feedback";` e adicione `meta` ao
`useMutation` (ao lado de `mutationFn`/`onSuccess`, que ficam intactos).

- [ ] **Step 1: Teste de fiação que falha**

Crie `apps/web/tests/feedback-toasts.test.tsx`. Usa o `queryClient` real (cujo `MutationCache`
tem o `onSuccess` da Task 1) e mocka `sonner` + `@/lib/api`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const success = vi.fn();
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));

vi.mock("@/lib/api", () => {
  const contracts = Object.assign(
    (_p: { id: string }) => ({
      confirm: { post: () => Promise.resolve({ data: { status: "confirmed" }, error: null }) },
    }),
    { post: () => Promise.resolve({ data: { id: "c1" }, error: null }) }
  );
  const installments = (_i: { installmentId: string }) => ({
    confirm: { post: () => Promise.resolve({ data: { status: "confirmed" }, error: null }) },
  });
  return { api: { api: { contracts, installments } } };
});

import { FEEDBACK } from "../src/lib/feedback";
import { useCreateContractMutation } from "../src/hooks/use-contract-mutations";
import { useConfirmPaymentMutation } from "../src/hooks/use-payment-mutations";
import { queryClient } from "../src/lib/query";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("feedback toasts wiring", () => {
  it("createContract toasts the success message", async () => {
    success.mockClear();
    const { result } = renderHook(() => useCreateContractMutation(), { wrapper });
    await result.current.mutateAsync({
      title: "T",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: { mode: "auto", totalAmountCents: 1000, installmentsCount: 1, firstDueDate: "2026-07-10" },
    });
    await waitFor(() => expect(success).toHaveBeenCalledWith(FEEDBACK.contractCreated));
  });

  it("confirmPayment toasts the success message", async () => {
    success.mockClear();
    const { result } = renderHook(() => useConfirmPaymentMutation("c1", "i1"), { wrapper });
    await result.current.mutateAsync();
    await waitFor(() => expect(success).toHaveBeenCalledWith(FEEDBACK.paymentConfirmed));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/feedback-toasts.test.tsx`
Expected: FAIL (mutations ainda sem `meta`).

- [ ] **Step 3: Adicionar `meta` em `use-payment-mutations.ts`**

`import { FEEDBACK } from "@/lib/feedback";` e, em cada hook:
- `useSubmitProofMutation`: `meta: { successMessage: FEEDBACK.proofSubmitted },`
- `useConfirmPaymentMutation`: `meta: { successMessage: FEEDBACK.paymentConfirmed },`
- `useDisputePaymentMutation`: `meta: { successMessage: FEEDBACK.paymentDisputed },`
- `useMarkPaidMutation`: `meta: { successMessage: FEEDBACK.installmentPaid },`

- [ ] **Step 4: Adicionar `meta` em `use-contract-mutations.ts`**

`import { FEEDBACK } from "@/lib/feedback";` e:
- `useCreateContractMutation`: `meta: { successMessage: FEEDBACK.contractCreated },`
- `useUpdateInstallmentMutation`: `meta: { successMessage: FEEDBACK.installmentUpdated },`
- `useDeleteContractMutation`: `meta: { successMessage: FEEDBACK.contractDeleted },`
- `useLeaveContractMutation`: `meta: { successMessage: FEEDBACK.contractLeft },`

- [ ] **Step 5: Adicionar `meta` em `use-participant-mutations.ts`**

`import { FEEDBACK } from "@/lib/feedback";` e:
- `useAddParticipantMutation`: `meta: { successMessage: FEEDBACK.participantAdded },`
- `useRemoveParticipantMutation`: `meta: { successMessage: FEEDBACK.participantRemoved },`
- `useUpdateParticipantRoleMutation`: `meta: { successMessage: FEEDBACK.roleUpdated },`
- `useCreateInviteMutation`: `meta: { successMessage: FEEDBACK.inviteCreated },`

- [ ] **Step 6: Adicionar `meta` em `use-invite.ts`**

`import { FEEDBACK } from "@/lib/feedback";` e no `useAcceptInviteMutation`:
`meta: { successMessage: FEEDBACK.inviteAccepted },`

- [ ] **Step 7: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/feedback-toasts.test.tsx`
Expected: PASS.

- [ ] **Step 8: Suíte web não regrediu**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde (os testes de invalidação seguem passando — `onSuccess` intacto).

- [ ] **Step 9: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/hooks/use-payment-mutations.ts apps/web/src/hooks/use-contract-mutations.ts apps/web/src/hooks/use-participant-mutations.ts apps/web/src/hooks/use-invite.ts apps/web/tests/feedback-toasts.test.tsx
git commit -m "feat(web): meta.successMessage nas mutations de escrita (toasts)"
```

---

## Task 3: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte web + typecheck + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: tudo verde.

- [ ] **Step 2: Smoke manual (dev)**

Suba `bun run dev`. Confirme um toast de sucesso em: criar contrato; editar parcela; enviar
comprovante / confirmar / contestar / marcar paga; adicionar/remover participante; alterar papel;
gerar convite; aceitar convite; excluir e sair de contrato. Confirme que **marcar notificação
lida não toasta** e que **erros continuam** toastando (ex.: ação inválida).

- [ ] **Step 3: Marcar a 7g no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, adicione a linha **7g** concluída:
`` | **7g** | Feedback de sucesso (toasts) | Toast de sucesso nas 13 ações de escrita via `mutation.meta.successMessage` (handler global em `query.ts`), mensagens centralizadas em `lib/feedback.ts`. | `plans/2026-06-14-fase-7g-feedback-toasts.md` ✅ **concluído** (merge em `develop`; suite verde) | ``

- [ ] **Step 4: Commit do roadmap + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 7g concluída no roadmap"
git checkout develop
git merge --no-ff feat/fase-7g-feedback-toasts -m "Merge: Fase 7g — feedback de sucesso (toasts)"
```

Expected: merge limpo; suite web verde em `develop`.

---

## Notas para o executor

- **Simétrico ao erro:** o `onError` global já existe; só adicionamos o `onSuccess`. Não chame
  `toast.success` dentro dos hooks — quem toasta é o handler global, lendo `meta`.
- **Sem literais:** mensagens só de `FEEDBACK`.
- **Navegação:** toasts sobrevivem à navegação SPA (o `Toaster` é raiz em `main.tsx`), então
  criar contrato / aceitar convite / excluir / sair mostram o toast mesmo navegando.
- **Fora de escopo:** `markRead`/`markAllRead` e `useDeleteAccountMutation` não recebem `meta`.
