# Fase 7a — Hardening de frontend (sessão + coerência de cache) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a fonte de sessão do client de `authClient.getSession()` (por navegação, vaza token) para `GET /api/me` cacheado, e centralizar a invalidação de cache num helper que sempre atualiza o dashboard.

**Architecture:** Uma query `['me']` (staleTime 5min) vira a fonte única de sessão, lida pelo guard (`ensureQueryData`) e pela sidebar. Um helper `invalidateContractViews(qc, contractId?)` concentra a regra de coerência (sempre `contracts` + `dashboard`, e `contract(id)` quando houver), aplicado em todas as mutations de escrita.

**Tech Stack:** React 19 + Vite, TanStack Router (code-based) + Query v5, Better Auth (`signIn/signUp/signOut`), Vitest. Web-only — **sem mudança de API** (`/api/me` já existe e retorna `{ id, name, email, image }`).

**Spec:** `docs/superpowers/specs/2026-06-13-fase-7a-frontend-hardening-design.md`

**Git:** branch `feat/fase-7a-frontend-hardening` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 7a no ROADMAP.

**Convenções:** código em inglês; sem literais; sem comentários óbvios. Não há UI nova (sem `frontend-design`).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/query-keys.ts` (mod) | `me` |
| `apps/web/src/hooks/use-me.ts` (criar) | `meQueryOptions`, `useMeQuery` |
| `apps/web/src/lib/require-session.ts` (criar) | `requireSession(qc, location)` testável |
| `apps/web/src/routes/protected.tsx` (mod) | guard usa `requireSession` (sem `getSession`) |
| `apps/web/src/components/app-sidebar.tsx` (mod) | `useMeQuery` no lugar de `useSession` |
| `apps/web/src/lib/invalidate-contract-views.ts` (criar) | helper de coerência |
| `apps/web/src/hooks/use-contract-mutations.ts` (mod) | usa o helper |
| `apps/web/src/hooks/use-payment-mutations.ts` (mod) | usa o helper |
| `apps/web/src/hooks/use-invite.ts` (mod) | usa o helper |
| `apps/web/src/hooks/use-participant-mutations.ts` (mod) | usa o helper |
| `apps/web/tests/use-me.test.tsx` (criar) | hook |
| `apps/web/tests/require-session.test.ts` (criar) | guard |
| `apps/web/tests/invalidate-contract-views.test.ts` (criar) | helper |
| `apps/web/tests/cache-coherence.test.tsx` (criar) | mutations invalidam dashboard |

---

## Task 1: Query key + hook de sessão

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/hooks/use-me.ts`
- Test: `apps/web/tests/use-me.test.tsx`

- [ ] **Step 1: Adicionar a query key**

Em `apps/web/src/lib/query-keys.ts`, adicione ao objeto `queryKeys`: `me: ["me"] as const,`.

- [ ] **Step 2: Teste que falha**

Crie `apps/web/tests/use-me.test.tsx` (padrão de `use-dashboard.test.tsx`):

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getMe = vi.fn();
vi.mock("@/lib/api", () => ({ api: { api: { me: { get: () => getMe() } } } }));

import { useMeQuery } from "../src/hooks/use-me";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMeQuery", () => {
  beforeEach(() => getMe.mockReset());

  it("unwraps the current user", async () => {
    getMe.mockResolvedValue({
      data: { id: "u1", name: "Eu", email: "eu@e.com", image: null },
      error: null,
    });
    const { result } = renderHook(() => useMeQuery(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Eu");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-me.test.tsx`
Expected: FAIL ("Cannot find module ../src/hooks/use-me").

- [ ] **Step 4: Implementar**

Crie `apps/web/src/hooks/use-me.ts`:

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const SESSION_STALE_MS = 5 * 60_000;

export const meQueryOptions = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => unwrap(api.api.me.get()),
  staleTime: SESSION_STALE_MS,
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-me.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/use-me.ts apps/web/tests/use-me.test.tsx
git commit -m "feat(web): sessão via /api/me cacheado (useMeQuery)"
```

---

## Task 2: Guard via `requireSession`

**Files:**
- Create: `apps/web/src/lib/require-session.ts`
- Modify: `apps/web/src/routes/protected.tsx`
- Test: `apps/web/tests/require-session.test.ts`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/require-session.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api-client";
import { requireSession } from "../src/lib/require-session";

function fakeQc(behavior: "ok" | "401" | "500") {
  return {
    ensureQueryData: vi.fn(() => {
      if (behavior === "ok") {
        return Promise.resolve({ id: "u1" });
      }
      const status = behavior === "401" ? 401 : 500;
      return Promise.reject(
        new ApiError({ code: "X", httpStatus: status, message: "x" })
      );
    }),
  } as never;
}

describe("requireSession", () => {
  it("resolves when a session exists", async () => {
    await expect(
      requireSession(fakeQc("ok"), "/contracts")
    ).resolves.toBeUndefined();
  });

  it("throws a redirect to /login on 401, carrying the target", async () => {
    let thrown: unknown;
    try {
      await requireSession(fakeQc("401"), "/contracts/123");
    } catch (e) {
      thrown = e;
    }
    // redirect() lança um objeto com `to` e `search`
    expect((thrown as { to?: string }).to).toBe("/login");
    expect((thrown as { search?: { redirect?: string } }).search?.redirect).toBe(
      "/contracts/123"
    );
  });

  it("rethrows non-401 errors", async () => {
    await expect(requireSession(fakeQc("500"), "/x")).rejects.toBeInstanceOf(
      ApiError
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/require-session.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/require-session").

- [ ] **Step 3: Implementar**

Crie `apps/web/src/lib/require-session.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/hooks/use-me";
import { ApiError } from "@/lib/api-client";

/** Ensures a session exists (via cached /api/me). Throws a redirect to /login on 401. */
export async function requireSession(
  queryClient: QueryClient,
  currentHref: string
): Promise<void> {
  try {
    await queryClient.ensureQueryData(meQueryOptions);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 401) {
      throw redirect({ to: "/login", search: { redirect: currentHref } });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Trocar o guard**

Em `apps/web/src/routes/protected.tsx`, substitua o `beforeLoad` que usa `authClient.getSession()` por:

```ts
import { createRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorFallback } from "@/components/error-fallback";
import { queryClient } from "@/lib/query";
import { requireSession } from "@/lib/require-session";
import { rootRoute } from "./root";

// ...ProtectedLayout inalterado...

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: ({ location }) => requireSession(queryClient, location.href),
  component: ProtectedLayout,
});
```

Remova o import de `authClient` e o `redirect` agora não é mais usado diretamente aqui (vem do `requireSession`).

- [ ] **Step 5: Rodar e ver passar + typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/require-session.test.ts`
Expected: PASS.
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/require-session.ts apps/web/src/routes/protected.tsx apps/web/tests/require-session.test.ts
git commit -m "feat(web): guard via /api/me cacheado (sem getSession por navegação)"
```

---

## Task 3: Sidebar usa `useMeQuery`

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Test: `apps/web/tests/app-sidebar.test.tsx` (ajustar)

- [ ] **Step 1: Ajustar o teste**

Em `apps/web/tests/app-sidebar.test.tsx`, troque o mock de `@/lib/auth-client` para não depender de `useSession` e mocke o `useMeQuery`. O mock de `@/lib/auth-client` deve manter `signOut`; remova `useSession` de lá. Adicione:

```tsx
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({ data: { id: "u1", name: "Test", email: "t@e.com", image: null } }),
}));
```

(Se o arquivo também mocka `@/hooks/use-notifications` por causa do `NotificationBell`, mantenha
esse mock.) O caso existente que verifica "Test" no rodapé deve continuar passando.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/app-sidebar.test.tsx`
Expected: FAIL (o componente ainda importa `useSession`).

- [ ] **Step 3: Implementar**

Em `apps/web/src/components/app-sidebar.tsx`:
- troque o import `import { signOut, useSession } from "@/lib/auth-client";` por
  `import { signOut } from "@/lib/auth-client";` + `import { useMeQuery } from "@/hooks/use-me";`
- troque `const { data: session } = useSession();` por `const { data: me } = useMeQuery();`
- troque o uso `session?.user.name ?? "..."` por `me?.name ?? "..."`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/app-sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/app-sidebar.tsx apps/web/tests/app-sidebar.test.tsx
git commit -m "feat(web): sidebar usa useMeQuery (fim do useSession)"
```

---

## Task 4: Helper de coerência de cache

**Files:**
- Create: `apps/web/src/lib/invalidate-contract-views.ts`
- Test: `apps/web/tests/invalidate-contract-views.test.ts`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/invalidate-contract-views.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { invalidateContractViews } from "../src/lib/invalidate-contract-views";

function spyQc() {
  return { invalidateQueries: vi.fn() } as never;
}

describe("invalidateContractViews", () => {
  it("always invalidates contracts and dashboard", () => {
    const qc = spyQc();
    invalidateContractViews(qc);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["contracts"] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("also invalidates the specific contract when an id is given", () => {
    const qc = spyQc();
    invalidateContractViews(qc, "c1");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["contract", "c1"] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/invalidate-contract-views.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar**

Crie `apps/web/src/lib/invalidate-contract-views.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Invalidates every view derived from contract/installment state. The dashboard
 * is a cross-contract aggregate, so any write must refresh it.
 */
export function invalidateContractViews(
  queryClient: QueryClient,
  contractId?: string
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  if (contractId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/invalidate-contract-views.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/invalidate-contract-views.ts apps/web/tests/invalidate-contract-views.test.ts
git commit -m "feat(web): invalidateContractViews (coerência de cache centralizada)"
```

---

## Task 5: Aplicar o helper em todas as mutations

**Files:**
- Modify: `apps/web/src/hooks/use-contract-mutations.ts`, `use-payment-mutations.ts`, `use-invite.ts`, `use-participant-mutations.ts`
- Test: `apps/web/tests/cache-coherence.test.tsx`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/cache-coherence.test.tsx`. Verifica que as mutations de escrita invalidam o dashboard (espião em `invalidateQueries`). Mocke o `@/lib/api` cobrindo os caminhos usados:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

vi.mock("@/lib/api", () => {
  const contracts = Object.assign(
    (_p: { id: string }) => ({
      installments: (_i: { installmentId: string }) => ({
        patch: () => Promise.resolve({ data: { id: "i1" }, error: null }),
      }),
    }),
    { post: () => Promise.resolve({ data: { id: "c1" }, error: null }) }
  );
  return { api: { api: { contracts } } };
});

import {
  useCreateContractMutation,
  useUpdateInstallmentMutation,
} from "../src/hooks/use-contract-mutations";

function wrap(client: ReturnType<typeof makeTestQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("cache coherence", () => {
  it("createContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateContractMutation(), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({
      title: "T",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: { mode: "auto", totalAmountCents: 1000, installmentsCount: 1, firstDueDate: "2026-07-10" },
    });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });

  it("updateInstallment invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateInstallmentMutation("c1"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({ installmentId: "i1", body: { amountCents: 500 } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/cache-coherence.test.tsx`
Expected: FAIL (mutations ainda não invalidam `dashboard`).

- [ ] **Step 3: Aplicar o helper**

`use-contract-mutations.ts` — importe `invalidateContractViews` e troque os `onSuccess`:

```ts
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
// createContract:
onSuccess: () => invalidateContractViews(qc),
// updateInstallment:
onSuccess: () => invalidateContractViews(qc, contractId),
```

`use-payment-mutations.ts` — no `invalidatePayment`, adicione o dashboard (mantém o installment):

```ts
import { invalidateContractViews } from "@/lib/invalidate-contract-views";

function invalidatePayment(qc: QueryClient, contractId: string, installmentId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.installment(installmentId) });
  invalidateContractViews(qc, contractId);
}
```

`use-invite.ts` — no `onSuccess` do aceitar convite, troque a invalidação de `contracts` por
`invalidateContractViews(qc)` e **mantenha** a de `myInvites`:

```ts
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
// onSuccess:
invalidateContractViews(qc);
qc.invalidateQueries({ queryKey: queryKeys.myInvites });
```

`use-participant-mutations.ts` — nos três `onSuccess` (add/remove/role), troque
`qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) })` por
`invalidateContractViews(qc, contractId)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/cache-coherence.test.tsx`
Expected: PASS.

- [ ] **Step 5: Não regrediu**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde (os testes existentes de mutations seguem passando — o helper ainda invalida `contracts`/`contract(id)`).

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/hooks/use-contract-mutations.ts apps/web/src/hooks/use-payment-mutations.ts apps/web/src/hooks/use-invite.ts apps/web/src/hooks/use-participant-mutations.ts apps/web/tests/cache-coherence.test.tsx
git commit -m "feat(web): mutations de escrita invalidam o dashboard (coerência de cache)"
```

---

## Task 6: Verificação final + merge + roadmap

- [ ] **Step 1: Grep de regressão (sem getSession/useSession)**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && grep -rn "getSession\|useSession" apps/web/src`
Expected: **nenhuma** ocorrência (o `auth-client.ts` pode parar de reexportar `useSession`; se ainda reexportar sem uso, remova-o do destructure para manter limpo).

- [ ] **Step 2: Suíte do web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde.

- [ ] **Step 3: Typecheck + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 4: Smoke manual (dev)**

Suba `bun run dev`. Confirme: (a) na aba Network, navegar entre rotas protegidas **não** dispara
`/api/me` a cada clique (só a cada ~5min ou no primeiro load); (b) o `get-session` do Better Auth
**não** é mais chamado pela navegação; (c) sem nenhum contrato, o dashboard mostra o vazio →
criar um contrato → voltar ao dashboard pela sidebar **já reflete** o novo contrato; (d) pagar/
editar parcela atualiza os números do dashboard ao voltar.

- [ ] **Step 5: Marcar a 7a no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, divida a linha **7** em sub-fases (ou registre a 7a) e marque-a
concluída:
`` | **7a** | Hardening de frontend | Sessão via `/api/me` cacheado (sem `getSession` por navegação, token não exposto), coerência de cache (`invalidateContractViews` em todas as escritas → dashboard sempre atualizado). | `plans/2026-06-13-fase-7a-frontend-hardening.md` ✅ **concluído** (merge em `develop`; suite verde) | ``
e deixe 7b (E2E), 7c (a11y) e 7d (performance/Lighthouse + code-splitting) como "a escrever".

- [ ] **Step 6: Commit do roadmap + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 7a concluída + fatia a Fase 7"
git checkout develop
git merge --no-ff feat/fase-7a-frontend-hardening -m "Merge: Fase 7a — hardening de frontend"
```

Expected: merge limpo; suite do web verde em `develop`.

---

## Notas para o executor

- **Sessão:** o client deixa de chamar o `get-session` do Better Auth — é isso que tira o token
  do JS. `signIn/signUp/signOut` continuam no `auth-client`. Login/logout já fazem reload completo
  (`window.location.href`), então o cache `['me']` reidrata naturalmente.
- **Guard testável:** a lógica vive em `requireSession` (testada); o `beforeLoad` só a chama. Não
  inline a lógica de redirect no `beforeLoad`.
- **Coerência:** sempre via `invalidateContractViews` — não volte a espalhar `invalidateQueries`
  de `dashboard` na mão. O `notifications`/`unread-count` ficam de fora (polling de 60s; o ator
  não recebe notificação da própria ação).
- **Sem mudança de API.** Se algum teste tentar bater em `/api/me` de verdade, é porque o mock do
  treaty não cobriu o caminho — ajuste o mock.
