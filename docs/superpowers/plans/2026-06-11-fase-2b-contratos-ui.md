# Fase 2b — Contratos & Parcelas (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a UI do core de contratos no `apps/web` — listar, criar (wizard 2 passos) e ver/editar contratos — consumindo a API tipada da Fase 2a via Eden, com fundação de erros/loading, formulários RHF+Zod e identidade visual B2.

**Architecture:** Camada de dados em hooks TanStack Query (prefetch via route loaders, mutations com invalidação alvo) sobre um `apiClient` que normaliza o `{data,error}` do Eden em `ApiError`. Formulários com React Hook Form + Zod (schemas em `@quitto/shared`); o wizard usa um único `useForm` + `FormProvider`. Estado: `useState` local quando basta, **nunca Context API** (lib próprias como RHF/Query são permitidas); Zustand só se necessário. Telas seguem a identidade B2 e **cada tela visual começa invocando as skills de design** (spec §11).

**Tech Stack:** React 19 + Vite, TanStack Router (code-based) + TanStack Query v5, React Hook Form + Zod, shadcn/ui (Radix via pacote `radix-ui`) + Tailwind v4 (tokens OKLch), sonner, react-error-boundary, Vitest + Testing Library.

> **Convenção (spec §9):** código/identificadores/rotas/comentários em inglês; texto ao usuário em pt-BR. Dinheiro em centavos no transporte; formatação R$ é da UI. Datas ISO `YYYY-MM-DD`.
>
> **Regras de estado (memória do projeto):** evitar `useState`/`useEffect` desnecessários (derivar no render; dados via Query; forms via RHF). Nunca Context API para o nosso estado.
>
> **Pré-requisitos:** Fase 2a em `develop` (API de contratos pronta e tipada). Crie a branch `feat/fase-2b-contratos-ui` a partir de `develop`. Postgres local de pé (`docker start quitto-pg`) e a API rodável, caso queira smoke manual — os testes de UI mockam a rede.
>
> **Padrões existentes a seguir:** componentes UI em `apps/web/src/components/ui/*` (ver `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx` — usam CVA + `cn` de `@/lib/utils`, Radix via `radix-ui`). Rotas em `apps/web/src/router.tsx` (code-based) sob `protectedRoute`. Eden cru em `@/lib/api`. `queryClient` em `@/lib/query`. Alias `@/` → `src`.

---

## Estrutura de arquivos (novos/alterados)

```
packages/shared/src/
├─ index.ts                      # + re-export dos schemas
└─ contracts.ts                  # NOVO: zod schemas (create contract, update installment)

apps/web/
├─ vitest.config.ts              # NOVO: ambiente jsdom + setup
├─ tests/
│  ├─ setup.ts                   # NOVO: jest-dom + cleanup
│  ├─ test-utils.tsx             # NOVO: renderWithProviders (QueryClient)
│  └─ ...                        # specs por tarefa
└─ src/
   ├─ lib/
   │  ├─ format.ts               # NOVO: centavos⇄R$, data BR
   │  ├─ api-client.ts           # NOVO: ApiError + call() (unwrap do Eden)
   │  ├─ error-message.ts        # NOVO: map de erro→mensagem pt-BR
   │  ├─ query-keys.ts           # NOVO: chaves estruturadas
   │  └─ query.ts                # ALTERA: QueryCache/MutationCache onError
   ├─ hooks/
   │  ├─ use-contracts.ts        # NOVO: useContractsQuery, useContractQuery
   │  └─ use-contract-mutations.ts # NOVO: create + update installment
   ├─ components/
   │  ├─ ui/
   │  │  ├─ badge.tsx            # NOVO (shadcn-style)
   │  │  ├─ progress.tsx         # NOVO (Radix Progress)
   │  │  ├─ sheet.tsx            # NOVO (Radix Dialog → drawer)
   │  │  └─ skeleton.tsx         # NOVO
   │  ├─ status-badge.tsx        # NOVO: status de parcela → label+cor
   │  ├─ stepper.tsx             # NOVO: passos numerados
   │  ├─ contract-row.tsx        # NOVO: linha-cartão da lista
   │  ├─ installment-drawer.tsx  # NOVO: drawer + edição (owner)
   │  ├─ error-fallback.tsx      # NOVO: fallback de rota
   │  └─ app-sidebar.tsx         # ALTERA: + Contratos, responsivo/bottom-nav
   ├─ routes/
   │  ├─ contracts-list.tsx      # NOVO
   │  ├─ contract-new.tsx        # NOVO (wizard)
   │  └─ contract-detail.tsx     # NOVO
   ├─ router.tsx                 # ALTERA: + 3 rotas com loaders
   └─ main.tsx                   # ALTERA: + <Toaster/> (sonner)
```

---

## Task 1: Dependências + setup de testes do front

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/tests/setup.ts`
- Create: `apps/web/tests/test-utils.tsx`
- Create: `apps/web/tests/smoke.test.tsx`

- [ ] **Step 1: Instalar dependências de runtime e de teste**

Na raiz do repo:
```bash
bun add --filter @quitto/web react-hook-form @hookform/resolvers sonner react-error-boundary
bun add --filter @quitto/web -d jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```
Expected: `apps/web/package.json` ganha essas deps; `bun.lock` atualizado. **Não** adicione `zustand` (só se uma tarefa futura exigir store; ver spec §8).

- [ ] **Step 2: Criar `apps/web/vitest.config.ts`**

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
  },
});
```

> Nota: o `vite.config.ts` continua para o dev/build; este arquivo é só para os testes (Vitest usa `vitest.config.ts` preferencialmente). O alias `@` é replicado aqui.

- [ ] **Step 3: Criar `apps/web/tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Criar `apps/web/tests/test-utils.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** Fresh QueryClient per test, retries off so errors surface immediately. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: { client?: QueryClient } & Omit<RenderOptions, "wrapper">
) {
  const client = options?.client ?? makeTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

- [ ] **Step 5: Escrever um smoke test de componente**

Create `apps/web/tests/smoke.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "./test-utils";

describe("test setup", () => {
  it("renders a component into jsdom", () => {
    renderWithProviders(<button type="button">Olá</button>);
    expect(screen.getByRole("button", { name: "Olá" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `bun --filter @quitto/web test`
Expected: PASS — o smoke test e o `eden-types.test.ts` existente passam (2 arquivos).

- [ ] **Step 7: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/tests/ bun.lock
git commit -m "chore(web): deps da 2b + setup de testes (jsdom + testing-library)"
```

---

## Task 2: Helpers de formatação (centavos ⇄ R$, data BR)

**Files:**
- Create: `apps/web/src/lib/format.ts`
- Test: `apps/web/tests/format.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatBRL, formatISODateBR, parseBRLToCents } from "../src/lib/format";

describe("formatBRL", () => {
  it("formats integer cents as Brazilian currency", () => {
    expect(formatBRL(120_000_00)).toBe("R$ 120.000,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(2_000_00)).toBe("R$ 2.000,00");
  });
});

describe("parseBRLToCents", () => {
  it("parses a BR currency string into integer cents", () => {
    expect(parseBRLToCents("2.000,00")).toBe(200_000);
    expect(parseBRLToCents("R$ 1.234,56")).toBe(123_456);
    expect(parseBRLToCents("10")).toBe(1000);
  });

  it("returns null for invalid input", () => {
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
});

describe("formatISODateBR", () => {
  it("formats an ISO date as DD/MM/YYYY without timezone drift", () => {
    expect(formatISODateBR("2026-07-10")).toBe("10/07/2026");
    expect(formatISODateBR("2026-02-28")).toBe("28/02/2026");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/format.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/lib/format.ts`**

```ts
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency (e.g. 200000 -> "R$ 2.000,00"). */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** Parses a BR currency string (with or without "R$") into integer cents, or null if invalid. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) {
    return null;
  }
  return Math.round(Number(cleaned) * 100);
}

/** Formats an ISO date (YYYY-MM-DD) as DD/MM/YYYY, splitting the string (no timezone drift). */
export function formatISODateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/format.test.ts`
Expected: PASS (3 describes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/tests/format.test.ts
git commit -m "feat(web): helpers de formatação (centavos⇄R$, data BR)"
```

---

## Task 3: Schemas Zod em `@quitto/shared`

**Files:**
- Create: `packages/shared/src/contracts.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/contracts.test.ts`

> Nota: o `@quitto/shared` ainda não tem testes nem script `test`. Estes testes rodam via Vitest do web (que importa o pacote) **ou** adicione um script. Para manter simples, coloque o teste em `apps/web/tests/shared-contracts.test.ts` importando de `@quitto/shared`. Use este caminho.

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/shared-contracts.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createContractSchema, updateInstallmentSchema } from "@quitto/shared";

const validAuto = {
  title: "Apê do irmão",
  ownerRole: "buyer" as const,
  requiresConfirmation: true,
  schedule: {
    mode: "auto" as const,
    totalAmountCents: 120_000_00,
    installmentsCount: 60,
    firstDueDate: "2026-07-10",
  },
};

describe("createContractSchema", () => {
  it("accepts a valid auto contract", () => {
    expect(createContractSchema.safeParse(validAuto).success).toBe(true);
  });

  it("accepts a valid custom contract", () => {
    const r = createContractSchema.safeParse({
      title: "Custom",
      ownerRole: "seller",
      requiresConfirmation: false,
      schedule: {
        mode: "custom",
        installments: [
          { amountCents: 50_000_00, dueDate: "2026-07-10" },
          { amountCents: 70_000_00, dueDate: "2026-08-10" },
        ],
      },
    }).success;
    expect(r).toBe(true);
  });

  it("rejects empty title", () => {
    expect(
      createContractSchema.safeParse({ ...validAuto, title: "" }).success
    ).toBe(false);
  });

  it("rejects installmentsCount below 1", () => {
    const r = createContractSchema.safeParse({
      ...validAuto,
      schedule: { ...validAuto.schedule, installmentsCount: 0 },
    }).success;
    expect(r).toBe(false);
  });

  it("rejects a custom schedule with no installments", () => {
    const r = createContractSchema.safeParse({
      title: "X",
      ownerRole: "neutral",
      requiresConfirmation: false,
      schedule: { mode: "custom", installments: [] },
    }).success;
    expect(r).toBe(false);
  });
});

describe("updateInstallmentSchema", () => {
  it("accepts a partial update with only amountCents", () => {
    expect(updateInstallmentSchema.safeParse({ amountCents: 999_99 }).success).toBe(true);
  });

  it("accepts only dueDate", () => {
    expect(updateInstallmentSchema.safeParse({ dueDate: "2026-09-10" }).success).toBe(true);
  });

  it("rejects amountCents below 1", () => {
    expect(updateInstallmentSchema.safeParse({ amountCents: 0 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/shared-contracts.test.ts`
Expected: FAIL — exports inexistentes.

- [ ] **Step 3: Implementar `packages/shared/src/contracts.ts`**

```ts
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

export const ownerRoleSchema = z.enum(["buyer", "seller", "neutral"]);

const scheduleAutoSchema = z.object({
  mode: z.literal("auto"),
  totalAmountCents: z.number().int().min(1, "Informe um valor"),
  installmentsCount: z.number().int().min(1, "Mínimo 1 parcela").max(600, "Máximo 600 parcelas"),
  firstDueDate: isoDate,
});

const scheduleCustomSchema = z.object({
  mode: z.literal("custom"),
  installments: z
    .array(z.object({ amountCents: z.number().int().min(1, "Informe um valor"), dueDate: isoDate }))
    .min(1, "Adicione ao menos uma parcela")
    .max(600, "Máximo 600 parcelas"),
});

export const createContractSchema = z.object({
  title: z.string().min(1, "Informe um título").max(200, "Título muito longo"),
  description: z.string().max(2000, "Descrição muito longa").optional(),
  ownerRole: ownerRoleSchema,
  requiresConfirmation: z.boolean(),
  schedule: z.discriminatedUnion("mode", [scheduleAutoSchema, scheduleCustomSchema]),
});

export const updateInstallmentSchema = z
  .object({
    amountCents: z.number().int().min(1, "Informe um valor").optional(),
    dueDate: isoDate.optional(),
  })
  .refine((v) => v.amountCents !== undefined || v.dueDate !== undefined, {
    message: "Altere ao menos um campo",
  });

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
export type OwnerRole = z.infer<typeof ownerRoleSchema>;
```

- [ ] **Step 4: Re-exportar em `packages/shared/src/index.ts`** (acrescente ao fim)

```ts
export * from "./contracts";
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/shared-contracts.test.ts`
Expected: PASS (2 describes, 8 testes).

- [ ] **Step 6: Typecheck (shared + web)**

Run: `bun --filter @quitto/shared typecheck && bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/contracts.ts packages/shared/src/index.ts apps/web/tests/shared-contracts.test.ts
git commit -m "feat(shared): schemas zod de contrato/parcela (create/update)"
```

---

## Task 4: `apiClient` — wrapper do Eden com `ApiError`

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/tests/api-client.test.ts`

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/api-client.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ApiError, unwrap } from "../src/lib/api-client";

describe("unwrap", () => {
  it("returns data when there is no error", async () => {
    const result = await unwrap(Promise.resolve({ data: { id: "abc" }, error: null }));
    expect(result).toEqual({ id: "abc" });
  });

  it("throws ApiError carrying code/status from the envelope", async () => {
    const eden = Promise.resolve({
      data: null,
      error: {
        status: 404,
        value: { error: { code: "NOT_FOUND", message: "Contrato não encontrado" } },
      },
    });
    await expect(unwrap(eden)).rejects.toBeInstanceOf(ApiError);
    await expect(unwrap(eden)).rejects.toMatchObject({
      code: "NOT_FOUND",
      httpStatus: 404,
      message: "Contrato não encontrado",
    });
  });

  it("falls back to a generic ApiError when the envelope is missing", async () => {
    const eden = Promise.resolve({ data: null, error: { status: 500, value: "boom" } });
    const err = await unwrap(eden).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(500);
    expect(err.code).toBe("UNKNOWN");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/api-client.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/lib/api-client.ts`**

```ts
import type { ApiErrorBody } from "@quitto/shared";

/** Typed client-side error mirroring the backend envelope (spec §8). */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(args: {
    code: string;
    httpStatus: number;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

type EdenResult<T> = { data: T | null; error: EdenError | null };
type EdenError = { status?: number; value?: unknown };

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.code === "string"
  );
}

/** Unwraps an Eden `{data,error}` promise: returns data, or throws a typed ApiError. */
export async function unwrap<T>(call: Promise<EdenResult<T>>): Promise<T> {
  const { data, error } = await call;
  if (error) {
    const status = error.status ?? 500;
    if (isErrorBody(error.value)) {
      const body = error.value.error;
      throw new ApiError({
        code: body.code,
        httpStatus: status,
        message: body.message,
        details: body.details,
      });
    }
    throw new ApiError({
      code: "UNKNOWN",
      httpStatus: status,
      message: "Algo deu errado. Tente novamente.",
    });
  }
  return data as T;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/api-client.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api-client.ts apps/web/tests/api-client.test.ts
git commit -m "feat(web): apiClient unwrap + ApiError tipado (spec §8)"
```

---

## Task 5: Mapeamento de erro→mensagem + fundação de feedback

**Files:**
- Create: `apps/web/src/lib/error-message.ts`
- Create: `apps/web/src/components/error-fallback.tsx`
- Modify: `apps/web/src/lib/query.ts`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/tests/error-message.test.ts`

- [ ] **Step 1: Escrever o teste do mapeamento**

Create `apps/web/tests/error-message.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/lib/api-client";
import { errorMessage } from "../src/lib/error-message";

describe("errorMessage", () => {
  it("uses the ApiError message when present", () => {
    expect(errorMessage(new ApiError({ code: "FORBIDDEN", httpStatus: 403, message: "Sem permissão" }))).toBe(
      "Sem permissão"
    );
  });

  it("maps a 5xx ApiError to a generic message", () => {
    expect(errorMessage(new ApiError({ code: "UNKNOWN", httpStatus: 500, message: "x" }))).toBe(
      "Algo deu errado. Tente novamente."
    );
  });

  it("handles non-ApiError values", () => {
    expect(errorMessage(new Error("nope"))).toBe("Algo deu errado. Tente novamente.");
    expect(errorMessage("weird")).toBe("Algo deu errado. Tente novamente.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/error-message.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/lib/error-message.ts`**

```ts
import { ApiError } from "./api-client";

const GENERIC = "Algo deu errado. Tente novamente.";

/** Maps any thrown value to a user-facing pt-BR message. 5xx and unknown -> generic. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.httpStatus >= 500 || error.code === "UNKNOWN") {
      return GENERIC;
    }
    return error.message;
  }
  return GENERIC;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/error-message.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Adicionar `onError` global em `apps/web/src/lib/query.ts`**

Substitua o conteúdo por:
```ts
import { MutationCache, QueryClient, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./api-client";
import { errorMessage } from "./error-message";

/** 401 is handled by the auth guard (redirect); don't toast it. */
function shouldToast(error: unknown): boolean {
  return !(error instanceof ApiError && error.httpStatus === 401);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (shouldToast(error)) {
        toast.error(errorMessage(error));
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (shouldToast(error)) {
        toast.error(errorMessage(error));
      }
    },
  }),
});
```

- [ ] **Step 6: Criar `apps/web/src/components/error-fallback.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";

/** Route-level error boundary fallback. Friendly message + retry (resets the boundary). */
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display font-semibold text-foreground text-lg">Ops, algo deu errado</p>
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <Button onClick={resetErrorBoundary} type="button">
        Tentar de novo
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Montar o `<Toaster/>` em `apps/web/src/main.tsx`**

Adicione o import e o componente dentro do provider:
```tsx
import { Toaster } from "sonner";
```
Renderize `<Toaster richColors position="top-right" />` logo após `<RouterProvider router={router} />` (dentro do `<QueryClientProvider>`):
```tsx
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
```

- [ ] **Step 8: Typecheck + testes + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test && bun --filter @quitto/web build`
Expected: PASS (build confirma que o sonner resolve e o main.tsx compila).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/error-message.ts apps/web/src/lib/query.ts apps/web/src/components/error-fallback.tsx apps/web/src/main.tsx apps/web/tests/error-message.test.ts
git commit -m "feat(web): fundação de erros (toasts globais, fallback de rota, map de erro)"
```

---

## Task 6: Query keys + hooks de dados

**Files:**
- Create: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/hooks/use-contracts.ts`
- Create: `apps/web/src/hooks/use-contract-mutations.ts`
- Test: `apps/web/tests/use-contracts.test.tsx`

> Os hooks usam o Eden cru (`@/lib/api`) via `unwrap`. Nos testes, mockamos `@/lib/api` com `vi.mock` para não tocar a rede.

- [ ] **Step 1: Criar `apps/web/src/lib/query-keys.ts`**

```ts
/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
};
```

- [ ] **Step 2: Criar `apps/web/src/hooks/use-contracts.ts`**

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** queryOptions reused by route loaders (ensureQueryData) and components (useQuery). */
export const contractsQueryOptions = queryOptions({
  queryKey: queryKeys.contracts,
  queryFn: () => unwrap(api.api.contracts.get()),
});

export const contractQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.contract(id),
    queryFn: () => unwrap(api.api.contracts({ id }).get()),
  });

export function useContractsQuery() {
  return useQuery(contractsQueryOptions);
}

export function useContractQuery(id: string) {
  return useQuery(contractQueryOptions(id));
}
```

- [ ] **Step 3: Criar `apps/web/src/hooks/use-contract-mutations.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateContractInput, UpdateInstallmentInput } from "@quitto/shared";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useCreateContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) => unwrap(api.api.contracts.post(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    },
  });
}

export function useUpdateInstallmentMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { installmentId: string; body: UpdateInstallmentInput }) =>
      unwrap(
        api.api.contracts({ id: contractId }).installments({ installmentId: vars.installmentId }).patch(vars.body)
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
    },
  });
}
```

- [ ] **Step 4: Escrever o teste dos hooks**

Create `apps/web/tests/use-contracts.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getContracts = vi.fn();
const postContract = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { api: { contracts: Object.assign(() => ({ get: vi.fn(), installments: () => ({ patch: vi.fn() }) }), { get: () => getContracts(), post: (b: unknown) => postContract(b) }) } },
}));

import { useContractsQuery } from "../src/hooks/use-contracts";
import { useCreateContractMutation } from "../src/hooks/use-contract-mutations";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useContractsQuery", () => {
  beforeEach(() => {
    getContracts.mockReset();
    postContract.mockReset();
  });

  it("returns the unwrapped list on success", async () => {
    getContracts.mockResolvedValue({
      data: [{ id: "c1", title: "T", ownerRole: "buyer", status: "active", totalCents: 1000, paidCents: 0, percent: 0, overdueCount: 0, installmentsCount: 1 }],
      error: null,
    });
    const { result } = renderHook(() => useContractsQuery(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.title).toBe("T");
  });
});

describe("useCreateContractMutation", () => {
  beforeEach(() => postContract.mockReset());

  it("posts the contract and resolves with the id", async () => {
    postContract.mockResolvedValue({ data: { id: "new-id" }, error: null });
    const { result } = renderHook(() => useCreateContractMutation(), { wrapper: wrapper() });
    const created = await result.current.mutateAsync({
      title: "X",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: { mode: "auto", totalAmountCents: 1000, installmentsCount: 1, firstDueDate: "2026-07-10" },
    });
    expect(created).toEqual({ id: "new-id" });
    expect(postContract).toHaveBeenCalledOnce();
  });
});
```

> Nota ao implementador: o mock acima precisa refletir o shape do Eden treaty (`api.api.contracts.get()`, `api.api.contracts.post(body)`, `api.api.contracts({id}).get()`, `...installments({installmentId}).patch(body)`). Ajuste o objeto do `vi.mock` se o typecheck/uso real divergir — o importante é que `get`/`post` retornem `{data,error}` e os testes verifiquem o unwrap + a chamada. Mantenha as asserções.

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/use-contracts.test.tsx`
Expected: PASS (2 describes).

- [ ] **Step 6: Typecheck**

Run: `bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/ apps/web/tests/use-contracts.test.tsx
git commit -m "feat(web): query keys + hooks de contratos (queries + mutations)"
```

---

## Task 7: Primitivas de UI (Badge, Progress, Sheet, Skeleton) + StatusBadge + Stepper

**Files:**
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/progress.tsx`
- Create: `apps/web/src/components/ui/sheet.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/status-badge.tsx`
- Create: `apps/web/src/components/stepper.tsx`
- Test: `apps/web/tests/status-badge.test.tsx`, `apps/web/tests/stepper.test.tsx`

> **Diretriz de UI (spec §11):** antes de escrever estes componentes, invoque as skills `frontend-design` / `ui-ux-pro-max` / `web-design-guidelines` e aterre na identidade B2 (teal/areia, Space Grotesk, status semânticos). As implementações abaixo são uma **base funcional** seguindo o padrão de `components/ui/*` existente — refine o visual com as skills sem quebrar os testes/props.

- [ ] **Step 1: Criar `apps/web/src/components/ui/badge.tsx`** (padrão CVA como `button.tsx`)

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-xs",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        brand: "bg-primary/10 text-primary",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
        danger: "bg-red-100 text-red-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
```

- [ ] **Step 2: Criar `apps/web/src/components/ui/progress.tsx`** (Radix Progress)

```tsx
import { Progress as ProgressPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & { value: number }) {
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-primary transition-all"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
```

- [ ] **Step 3: Criar `apps/web/src/components/ui/skeleton.tsx`**

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
```

- [ ] **Step 4: Criar `apps/web/src/components/ui/sheet.tsx`** (Radix Dialog como drawer lateral)

```tsx
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;

export function SheetContent({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { title: string; children: ReactNode }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 border-border border-l bg-background p-6 shadow-lg focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <SheetPrimitive.Title className="font-display font-semibold text-foreground text-lg">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="size-5" />
          </SheetPrimitive.Close>
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
```

- [ ] **Step 5: Escrever o teste do StatusBadge**

Create `apps/web/tests/status-badge.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../src/components/status-badge";

describe("StatusBadge", () => {
  it("renders pt-BR label for each status", () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText("paga")).toBeInTheDocument();
  });

  it("shows 'atrasada' for a pending installment past due", () => {
    render(<StatusBadge status="pending" overdue />);
    expect(screen.getByText(/atrasada/i)).toBeInTheDocument();
  });

  it("shows 'pendente' for a pending installment not overdue", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pendente")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implementar `apps/web/src/components/status-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";

// Status arrives from the Eden client typed as `string`; accept string and map with fallbacks.
const LABELS: Record<string, string> = {
  pending: "pendente",
  awaiting_confirmation: "aguardando",
  confirmed: "confirmada",
  disputed: "contestada",
  paid: "paga",
};

const TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  confirmed: "success",
  pending: "warning",
  awaiting_confirmation: "warning",
  disputed: "danger",
};

const PAID = new Set(["paid", "confirmed"]);

/** Maps an installment status string (+ overdue flag) to a semantic pt-BR badge. */
export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue && !PAID.has(status)) {
    return <Badge tone="danger">atrasada</Badge>;
  }
  return <Badge tone={TONES[status] ?? "neutral"}>{LABELS[status] ?? status}</Badge>;
}
```

- [ ] **Step 7: Escrever o teste do Stepper**

Create `apps/web/tests/stepper.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stepper } from "../src/components/stepper";

const steps = [{ label: "Básico" }, { label: "Parcelas" }];

describe("Stepper", () => {
  it("renders numbered steps with the current one marked", () => {
    render(<Stepper steps={steps} current={1} onStepClick={() => {}} />);
    expect(screen.getByText("Básico")).toBeInTheDocument();
    expect(screen.getByText("Parcelas")).toBeInTheDocument();
  });

  it("lets you click a completed step but not a future one", async () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={steps} current={1} onStepClick={onStepClick} />);
    await userEvent.click(screen.getByRole("button", { name: /Básico/i }));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 8: Implementar `apps/web/src/components/stepper.tsx`**

```tsx
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { label: string };

/** Numbered step indicator. Completed steps (index < current) are clickable to go back. */
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: Step[];
  current: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li className="flex items-center gap-2" key={step.label}>
            <button
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 font-display font-bold text-xs",
                done && "border-emerald-600 bg-emerald-600 text-white",
                active && "border-primary bg-primary text-primary-foreground",
                !(done || active) && "border-border bg-background text-muted-foreground"
              )}
              disabled={!done}
              onClick={() => onStepClick(index)}
              type="button"
            >
              {done ? <Check className="size-4" /> : index + 1}
            </button>
            <span className={cn("text-sm", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
            {index < steps.length - 1 && <span className="mx-1 h-0.5 w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 9: Rodar testes + typecheck**

Run: `bun --filter @quitto/web test tests/status-badge.test.tsx tests/stepper.test.tsx && bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ui/ apps/web/src/components/status-badge.tsx apps/web/src/components/stepper.tsx apps/web/tests/status-badge.test.tsx apps/web/tests/stepper.test.tsx
git commit -m "feat(web): primitivas UI (badge/progress/sheet/skeleton) + StatusBadge + Stepper"
```

---

## Task 8: Lista de contratos (rota + página)

**Files:**
- Create: `apps/web/src/components/contract-row.tsx`
- Create: `apps/web/src/routes/contracts-list.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/tests/contract-row.test.tsx`

> **Diretriz de UI (spec §11):** invoque as skills de design antes; aterre no layout "linhas largas" aprovado e na identidade B2. A base abaixo cumpre o contrato dos testes.

- [ ] **Step 1: Escrever o teste do ContractRow**

Create `apps/web/tests/contract-row.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractRow } from "../src/components/contract-row";

const item = {
  id: "c1",
  title: "Apê do irmão",
  ownerRole: "buyer",
  status: "active",
  totalCents: 120_000_00,
  paidCents: 45_600_00,
  percent: 38,
  overdueCount: 2,
  installmentsCount: 60,
};

describe("ContractRow", () => {
  it("shows title, formatted paid/total and overdue badge", () => {
    render(<ContractRow contract={item} />);
    expect(screen.getByText("Apê do irmão")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?120\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/2 atrasadas/i)).toBeInTheDocument();
  });

  it("shows 'em dia' when there are no overdue installments", () => {
    render(<ContractRow contract={{ ...item, overdueCount: 0 }} />);
    expect(screen.getByText(/em dia/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/contract-row.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/contract-row.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";

type ContractListItem = {
  id: string;
  title: string;
  ownerRole: string;
  status: string;
  totalCents: number;
  paidCents: number;
  percent: number;
  overdueCount: number;
  installmentsCount: number;
};

const ROLE_LABELS: Record<string, string> = { buyer: "comprador", seller: "vendedor", neutral: "neutro" };

/** Wide-row card for the contracts list. Links to the contract detail. */
export function ContractRow({ contract }: { contract: ContractListItem }) {
  return (
    <Link
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
      params={{ id: contract.id }}
      to="/contracts/$id"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-foreground">{contract.title}</span>
          <Badge tone="brand">{ROLE_LABELS[contract.ownerRole] ?? contract.ownerRole}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          {formatBRL(contract.paidCents)} / {formatBRL(contract.totalCents)} · {contract.installmentsCount} parcelas
        </p>
      </div>
      <div className="w-full sm:w-40">
        <Progress value={contract.percent} />
        <p className="mt-1 text-muted-foreground text-xs">{contract.percent}% quitado</p>
      </div>
      {contract.overdueCount > 0 ? (
        <Badge tone="danger">{contract.overdueCount} atrasadas</Badge>
      ) : (
        <Badge tone="success">em dia</Badge>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/contract-row.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Implementar a página `apps/web/src/routes/contracts-list.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractRow } from "@/components/contract-row";
import { useContractsQuery } from "@/hooks/use-contracts";

export function ContractsListPage() {
  const { data, isPending } = useContractsQuery();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Contratos</h1>
        <Button asChild>
          <Link to="/contracts/new">Novo contrato</Link>
        </Button>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {data.map((contract) => (
            <ContractRow contract={contract} key={contract.id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Você ainda não tem contratos.</p>
          <Button asChild>
            <Link to="/contracts/new">Criar seu primeiro contrato</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

> Nota: `Button asChild` usa o slot do shadcn. Se o `button.tsx` atual não suportar `asChild`, troque por `<Link>` estilizado com `buttonVariants()` (export já presente no padrão shadcn) — verifique `button.tsx` e use o que existir. Mantenha os elementos clicáveis.

- [ ] **Step 6: Registrar a rota em `apps/web/src/router.tsx`**

Adicione imports e a rota com loader (prefetch). Acrescente:
```ts
import { contractsQueryOptions } from "./hooks/use-contracts";
import { queryClient } from "./lib/query";
import { ContractsListPage } from "./routes/contracts-list";

const contractsListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts",
  loader: () => queryClient.ensureQueryData(contractsQueryOptions),
  component: ContractsListPage,
});
```
E inclua `contractsListRoute` nos filhos do `protectedRoute`:
```ts
const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([dashboardRoute, contractsListRoute]),
]);
```

- [ ] **Step 7: Typecheck + testes + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test && bun --filter @quitto/web build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/contract-row.tsx apps/web/src/routes/contracts-list.tsx apps/web/src/router.tsx apps/web/tests/contract-row.test.tsx
git commit -m "feat(web): lista de contratos (linhas largas + loader + estados)"
```

---

## Task 9: Wizard de criação (rota + 2 passos)

**Files:**
- Create: `apps/web/src/routes/contract-new.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/tests/contract-new.test.tsx`

> **Diretriz de UI (spec §11):** invoque as skills de design antes. Estado num único `useForm` + `FormProvider`; passos via `useFormContext`; índice do passo em `useState` simples. Preview compacto no modo auto; lista editável no modo custom. A base abaixo cumpre o contrato dos testes.

- [ ] **Step 1: Escrever o teste do wizard**

Create `apps/web/tests/contract-new.test.tsx`:
```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useCreateContractMutation: () => ({ mutateAsync, isPending: false }),
}));

import { ContractNewPage } from "../src/routes/contract-new";

describe("ContractNewPage (wizard)", () => {
  beforeEach(() => {
    navigate.mockReset();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "new-id" });
  });

  it("blocks advancing from step 1 when title is empty", async () => {
    renderWithProviders(<ContractNewPage />);
    await userEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(await screen.findByText(/informe um título/i)).toBeInTheDocument();
  });

  it("creates a contract (auto) and navigates to its detail", async () => {
    renderWithProviders(<ContractNewPage />);
    await userEvent.type(screen.getByLabelText(/título/i), "Apê do irmão");
    await userEvent.click(screen.getByRole("button", { name: /avançar/i }));

    await userEvent.type(screen.getByLabelText(/valor total/i), "120000");
    await userEvent.type(screen.getByLabelText(/n.* de parcelas/i), "60");
    await userEvent.type(screen.getByLabelText(/1.* vencimento/i), "2026-07-10");
    await userEvent.click(screen.getByRole("button", { name: /criar contrato/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/contracts/$id", params: { id: "new-id" } }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/contract-new.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/routes/contract-new.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { createContractSchema, type CreateContractInput } from "@quitto/shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/stepper";
import { useCreateContractMutation } from "@/hooks/use-contract-mutations";
import { formatBRL, formatISODateBR } from "@/lib/format";

const STEPS = [{ label: "Básico" }, { label: "Parcelas" }];

function FieldError({ name }: { name: string }) {
  const { formState } = useFormContext<CreateContractInput>();
  // biome-ignore lint/suspicious/noExplicitAny: RHF nested error access by string path
  const err = (formState.errors as any)?.[name];
  return err ? <p className="mt-1 text-red-600 text-xs">{String(err.message)}</p> : null;
}

function StepBasic() {
  const { register } = useFormContext<CreateContractInput>();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input id="title" {...register("title")} />
        <FieldError name="title" />
      </div>
      <div>
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input id="description" {...register("description")} />
      </div>
      <div>
        <Label htmlFor="ownerRole">Meu papel</Label>
        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" id="ownerRole" {...register("ownerRole")}>
          <option value="buyer">Comprador</option>
          <option value="seller">Vendedor</option>
          <option value="neutral">Neutro</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("requiresConfirmation")} />
        Exige confirmação da outra parte
      </label>
    </div>
  );
}

function AutoSchedule() {
  const { register, watch } = useFormContext<CreateContractInput>();
  const total = Number(watch("schedule.totalAmountCents")) || 0;
  const count = Number(watch("schedule.installmentsCount")) || 0;
  const per = count > 0 ? Math.floor(total / count) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="total">Valor total (centavos)</Label>
        <Input id="total" type="number" {...register("schedule.totalAmountCents", { valueAsNumber: true })} />
      </div>
      <div>
        <Label htmlFor="count">Nº de parcelas</Label>
        <Input id="count" type="number" {...register("schedule.installmentsCount", { valueAsNumber: true })} />
      </div>
      <div>
        <Label htmlFor="first">1º vencimento</Label>
        <Input id="first" placeholder="AAAA-MM-DD" {...register("schedule.firstDueDate")} />
      </div>
      {count > 0 && total > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          {count} parcelas de ~{formatBRL(per)} · soma {formatBRL(total)}
        </div>
      ) : null}
    </div>
  );
}

function CustomSchedule() {
  const { control, register } = useFormContext<CreateContractInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "schedule.installments" as never });
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div className="flex items-end gap-2" key={field.id}>
          <div className="flex-1">
            <Label>Valor (centavos)</Label>
            <Input type="number" {...register(`schedule.installments.${index}.amountCents` as const, { valueAsNumber: true })} />
          </div>
          <div className="flex-1">
            <Label>Vencimento</Label>
            <Input placeholder="AAAA-MM-DD" {...register(`schedule.installments.${index}.dueDate` as const)} />
          </div>
          <Button onClick={() => remove(index)} type="button" variant="ghost">Remover</Button>
        </div>
      ))}
      <Button onClick={() => append({ amountCents: 0, dueDate: "" })} type="button" variant="outline">
        Adicionar parcela
      </Button>
    </div>
  );
}

export function ContractNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateContractMutation();
  const [step, setStep] = useState(0);

  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: { mode: "auto", totalAmountCents: 0, installmentsCount: 1, firstDueDate: "" },
    },
  });

  const mode = form.watch("schedule.mode");

  async function goNext() {
    const ok = await form.trigger(["title", "ownerRole", "requiresConfirmation"]);
    if (ok) {
      setStep(1);
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const created = await createMutation.mutateAsync(values);
    navigate({ to: "/contracts/$id", params: { id: created.id } });
  });

  function setMode(next: "auto" | "custom") {
    form.setValue(
      "schedule",
      next === "auto"
        ? { mode: "auto", totalAmountCents: 0, installmentsCount: 1, firstDueDate: "" }
        : { mode: "custom", installments: [{ amountCents: 0, dueDate: "" }] }
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 font-display font-bold text-2xl text-foreground">Novo contrato</h1>
      <div className="mb-6">
        <Stepper current={step} onStepClick={setStep} steps={STEPS} />
      </div>

      <FormProvider {...form}>
        <form onSubmit={onSubmit}>
          {step === 0 ? (
            <>
              <StepBasic />
              <div className="mt-6 flex justify-end">
                <Button onClick={goNext} type="button">Avançar</Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex overflow-hidden rounded-md border border-border text-sm">
                <button className={mode === "auto" ? "bg-primary px-3 py-1.5 text-primary-foreground" : "px-3 py-1.5"} onClick={() => setMode("auto")} type="button">
                  Automático
                </button>
                <button className={mode === "custom" ? "bg-primary px-3 py-1.5 text-primary-foreground" : "px-3 py-1.5"} onClick={() => setMode("custom")} type="button">
                  Personalizado
                </button>
              </div>
              {mode === "auto" ? <AutoSchedule /> : <CustomSchedule />}
              <div className="mt-6 flex justify-between">
                <Button onClick={() => setStep(0)} type="button" variant="outline">Voltar</Button>
                <Button disabled={createMutation.isPending} type="submit">Criar contrato</Button>
              </div>
            </>
          )}
        </form>
      </FormProvider>
    </div>
  );
}
```

> Nota: `formatISODateBR` é importado para uso no preview se você optar por exibir o último vencimento — opcional. Remova o import se não usar (Biome reclama de import não usado).

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/contract-new.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Registrar a rota em `apps/web/src/router.tsx`**

```ts
import { ContractNewPage } from "./routes/contract-new";

const contractNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/new",
  component: ContractNewPage,
});
```
Inclua `contractNewRoute` nos filhos do `protectedRoute` (antes da rota `/contracts/$id` para evitar conflito de match com o param):
```ts
protectedRoute.addChildren([dashboardRoute, contractsListRoute, contractNewRoute]),
```

- [ ] **Step 6: Typecheck + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/contract-new.tsx apps/web/src/router.tsx apps/web/tests/contract-new.test.tsx
git commit -m "feat(web): wizard de criação (2 passos, RHF FormProvider, auto/custom)"
```

---

## Task 10: Tela de contrato (rota + detalhe)

**Files:**
- Create: `apps/web/src/routes/contract-detail.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/tests/contract-detail.test.tsx`

> **Diretriz de UI (spec §11):** invoque as skills de design antes; layout coluna única (faixa de stats + barra + cartão de participantes + lista de parcelas). A base abaixo cumpre o contrato dos testes. O drawer entra na Task 11.

- [ ] **Step 1: Escrever o teste do detalhe**

Create `apps/web/tests/contract-detail.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const useContractQuery = vi.fn();
vi.mock("../src/hooks/use-contracts", () => ({ useContractQuery: () => useContractQuery() }));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ id: "c1" }) }));

import { ContractDetailPage } from "../src/routes/contract-detail";

const detail = {
  role: "owner",
  contract: { id: "c1", title: "Apê do irmão", description: null, ownerRole: "buyer", requiresConfirmation: true, status: "active" },
  progress: { totalCents: 120_000_00, paidCents: 45_600_00, remainingCents: 74_400_00, percent: 38, overdueCount: 2 },
  installments: [
    { id: "i1", sequence: 1, amountCents: 2_000_00, dueDate: "2026-07-10", status: "paid" },
    { id: "i2", sequence: 2, amountCents: 2_000_00, dueDate: "2026-08-10", status: "pending" },
  ],
  participants: [{ id: "p1", displayName: "Você", role: "owner", linked: true }],
};

describe("ContractDetailPage", () => {
  beforeEach(() => useContractQuery.mockReset());

  it("renders stats and installments from the query data", () => {
    useContractQuery.mockReturnValue({ data: detail, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByText("Apê do irmão")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?74\.400,00/)).toBeInTheDocument(); // restante
    expect(screen.getAllByText(/R\$\s?2\.000,00/).length).toBeGreaterThanOrEqual(2); // parcelas
  });

  it("shows a skeleton while pending", () => {
    useContractQuery.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderWithProviders(<ContractDetailPage />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/contract-detail.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/routes/contract-detail.tsx`**

```tsx
import { useParams } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useContractQuery } from "@/hooks/use-contracts";
import { formatBRL, formatISODateBR } from "@/lib/format";

function isOverdue(dueDate: string, status: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return status !== "paid" && status !== "confirmed" && status !== "awaiting_confirmation" && dueDate < today;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-display font-bold ${tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

export function ContractDetailPage() {
  const { id } = useParams({ from: "/protected/contracts/$id" });
  const { data, isPending } = useContractQuery(id);

  if (isPending || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { contract, progress, installments } = data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 font-display font-bold text-2xl text-foreground">{contract.title}</h1>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={formatBRL(progress.totalCents)} />
        <Stat label="Pago" tone="green" value={formatBRL(progress.paidCents)} />
        <Stat label="Restante" value={formatBRL(progress.remainingCents)} />
        <Stat label="Atrasadas" tone={progress.overdueCount > 0 ? "red" : undefined} value={String(progress.overdueCount)} />
      </div>
      <Progress className="mb-6" value={progress.percent} />

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-muted-foreground text-xs">Participantes</p>
        <ul className="flex flex-col gap-1">
          {data.participants.map((p) => (
            <li className="text-foreground text-sm" key={p.id}>
              {p.displayName} <span className="text-muted-foreground">({p.role})</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-2 text-muted-foreground text-xs">Parcelas</p>
      <ul className="flex flex-col gap-2">
        {installments.map((it) => (
          <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3" key={it.id}>
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs">{it.sequence}</span>
            <span className="flex-1 text-sm">{formatISODateBR(it.dueDate)}</span>
            <span className="font-semibold text-sm">{formatBRL(it.amountCents)}</span>
            <StatusBadge overdue={isOverdue(it.dueDate, it.status)} status={it.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> Nota: `StatusBadge` (Task 7) já aceita `status: string` e mapeia desconhecido→neutro, então `status={it.status}` funciona sem cast.

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/contract-detail.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Registrar a rota em `apps/web/src/router.tsx`**

```ts
import { contractQueryOptions } from "./hooks/use-contracts";
import { ContractDetailPage } from "./routes/contract-detail";

const contractDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/$id",
  loader: ({ params }) => queryClient.ensureQueryData(contractQueryOptions(params.id)),
  component: ContractDetailPage,
});
```
Inclua nos filhos (depois de `/contracts/new`):
```ts
protectedRoute.addChildren([dashboardRoute, contractsListRoute, contractNewRoute, contractDetailRoute]),
```

- [ ] **Step 6: Typecheck + testes + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test && bun --filter @quitto/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/contract-detail.tsx apps/web/src/components/status-badge.tsx apps/web/src/router.tsx apps/web/tests/contract-detail.test.tsx
git commit -m "feat(web): tela de contrato (stats + progresso + participantes + parcelas)"
```

---

## Task 11: Drawer da parcela + edição (owner)

**Files:**
- Create: `apps/web/src/components/installment-drawer.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Test: `apps/web/tests/installment-drawer.test.tsx`

> **Diretriz de UI (spec §11):** invoque as skills de design antes. Drawer "ver → editar": leitura por padrão; owner clica "Editar parcela" e edita valor/vencimento (RHF + Zod) com Salvar/Cancelar. Não-owner: só leitura. Nota "comprovantes/pagamento → Fase 3".

- [ ] **Step 1: Escrever o teste do drawer**

Create `apps/web/tests/installment-drawer.test.tsx`:
```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateInstallmentMutation: () => ({ mutateAsync, isPending: false }),
}));

import { InstallmentDrawer } from "../src/components/installment-drawer";

const installment = { id: "i2", sequence: 2, amountCents: 2_000_00, dueDate: "2026-08-10", status: "pending" };

describe("InstallmentDrawer", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "i2" });
  });

  it("shows read-only detail and an edit button for the owner", () => {
    renderWithProviders(
      <InstallmentDrawer contractId="c1" installment={installment} onClose={() => {}} open role="owner" />
    );
    expect(screen.getByText(/parcela 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar parcela/i })).toBeInTheDocument();
  });

  it("hides the edit button for a non-owner", () => {
    renderWithProviders(
      <InstallmentDrawer contractId="c1" installment={installment} onClose={() => {}} open role="viewer" />
    );
    expect(screen.queryByRole("button", { name: /editar parcela/i })).not.toBeInTheDocument();
  });

  it("owner edits the amount and saves (calls the mutation)", async () => {
    renderWithProviders(
      <InstallmentDrawer contractId="c1" installment={installment} onClose={() => {}} open role="owner" />
    );
    await userEvent.click(screen.getByRole("button", { name: /editar parcela/i }));
    const amount = screen.getByLabelText(/valor/i);
    await userEvent.clear(amount);
    await userEvent.type(amount, "99999");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith({ installmentId: "i2", body: { amountCents: 99_999 } });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/installment-drawer.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `apps/web/src/components/installment-drawer.tsx`**

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { updateInstallmentSchema, type UpdateInstallmentInput } from "@quitto/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useUpdateInstallmentMutation } from "@/hooks/use-contract-mutations";
import { formatBRL, formatISODateBR } from "@/lib/format";

type Installment = { id: string; sequence: number; amountCents: number; dueDate: string; status: string };

export function InstallmentDrawer({
  contractId,
  installment,
  role,
  open,
  onClose,
}: {
  contractId: string;
  installment: Installment | null;
  role: string;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateInstallmentMutation(contractId);
  const form = useForm<UpdateInstallmentInput>({ resolver: zodResolver(updateInstallmentSchema) });

  if (!installment) {
    return null;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({ installmentId: installment.id, body: values });
    setEditing(false);
    onClose();
  });

  function startEdit() {
    form.reset({ amountCents: installment?.amountCents, dueDate: installment?.dueDate });
    setEditing(true);
  }

  return (
    <Sheet onOpenChange={(o) => !o && onClose()} open={open}>
      <SheetContent title={`Parcela ${installment.sequence}`}>
        <StatusBadge status={installment.status} />
        {editing ? (
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="amount">Valor (centavos)</Label>
              <Input id="amount" type="number" {...form.register("amountCents", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="due">Vencimento</Label>
              <Input id="due" placeholder="AAAA-MM-DD" {...form.register("dueDate")} />
            </div>
            <div className="flex gap-2">
              <Button disabled={updateMutation.isPending} type="submit">Salvar</Button>
              <Button onClick={() => setEditing(false)} type="button" variant="outline">Cancelar</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Valor</p>
              <p className="font-semibold text-foreground">{formatBRL(installment.amountCents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Vencimento</p>
              <p className="font-semibold text-foreground">{formatISODateBR(installment.dueDate)}</p>
            </div>
            {role === "owner" ? (
              <Button onClick={startEdit} type="button">Editar parcela</Button>
            ) : null}
            <p className="border-border border-t border-dashed pt-3 text-muted-foreground text-xs">
              Comprovantes e marcar como paga → em breve (Fase 3)
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/installment-drawer.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Ligar o drawer na tela de contrato `apps/web/src/routes/contract-detail.tsx`**

Adicione o import e um `useState` para a parcela selecionada; torne cada `<li>` de parcela um botão que abre o drawer. Acrescente no topo do componente (após obter `data`):
```tsx
const [openId, setOpenId] = useState<string | null>(null);
const selected = data.installments.find((it) => it.id === openId) ?? null;
```
Troque cada item da lista de parcelas por um botão clicável:
```tsx
<li key={it.id}>
  <button
    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40"
    onClick={() => setOpenId(it.id)}
    type="button"
  >
    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs">{it.sequence}</span>
    <span className="flex-1 text-sm">{formatISODateBR(it.dueDate)}</span>
    <span className="font-semibold text-sm">{formatBRL(it.amountCents)}</span>
    <StatusBadge overdue={isOverdue(it.dueDate, it.status)} status={it.status} />
  </button>
</li>
```
E renderize o drawer no fim do JSX (antes de fechar a div raiz):
```tsx
<InstallmentDrawer
  contractId={contract.id}
  installment={selected}
  onClose={() => setOpenId(null)}
  open={openId !== null}
  role={data.role}
/>
```
Imports a adicionar: `import { useState } from "react";` e `import { InstallmentDrawer } from "@/components/installment-drawer";`.

- [ ] **Step 6: Typecheck + testes + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web test && bun --filter @quitto/web build`
Expected: PASS (toda a suíte do web).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/installment-drawer.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/installment-drawer.test.tsx
git commit -m "feat(web): drawer da parcela + edição de valor/vencimento (owner)"
```

---

## Task 12: Shell — item "Contratos" + responsivo (bottom-nav no mobile)

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Test: `apps/web/tests/app-sidebar.test.tsx`

> **Diretriz de UI (spec §11):** invoque as skills de design antes. Sidebar no desktop, bottom-nav no mobile (mesmos itens: Dashboard, Contratos). A base abaixo cumpre o contrato do teste; refine o visual com as skills.

- [ ] **Step 1: Escrever o teste**

Create `apps/web/tests/app-sidebar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Test" } } }),
  signOut: vi.fn(),
}));

import { AppSidebar } from "../src/components/app-sidebar";

describe("AppSidebar", () => {
  it("renders Dashboard and Contratos nav items", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Contratos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter @quitto/web test tests/app-sidebar.test.tsx`
Expected: FAIL — "Contratos" ainda não existe.

- [ ] **Step 3: Atualizar `apps/web/src/components/app-sidebar.tsx`** (adiciona Contratos + responsivo)

```tsx
import { Link } from "@tanstack/react-router";
import { FileText, LayoutDashboard } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

async function handleSignOut() {
  await signOut();
  window.location.href = "/login";
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contracts", label: "Contratos", icon: FileText },
] as const;

export function AppSidebar() {
  const { data: session } = useSession();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-col border-border border-r bg-card p-4 sm:flex">
        <span className="mb-6 font-extrabold text-lg text-primary">◷ Quitto</span>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted [&.active]:bg-primary/10 [&.active]:font-semibold [&.active]:text-primary"
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-border border-t pt-3">
          <p className="mb-2 truncate text-foreground text-sm">{session?.user.name ?? "..."}</p>
          <button className="text-muted-foreground text-sm underline" onClick={handleSignOut} type="button">
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile bottom-nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-border border-t bg-card sm:hidden">
        {NAV.map((item) => (
          <Link
            className="flex flex-1 flex-col items-center gap-1 py-2 text-muted-foreground text-xs [&.active]:text-primary"
            key={item.to}
            to={item.to}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
```

> Nota: como o bottom-nav é fixo no mobile, o `protected.tsx` deve dar um respiro no rodapé. Opcional: adicione `pb-16 sm:pb-0` ao container de conteúdo em `protected.tsx`. Faça se for trivial; senão, deixe para o polimento.

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter @quitto/web test tests/app-sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + build**

Run: `bun --filter @quitto/web typecheck && bun --filter @quitto/web build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/tests/app-sidebar.test.tsx
git commit -m "feat(web): shell com Contratos + bottom-nav no mobile"
```

---

## Task 13: Fechar a fase — suíte completa, polimento de design e merge

**Files:** (verificação + integração)

- [ ] **Step 1: Passada de design nas telas (skills obrigatórias — spec §11)**

Revise as telas (lista, wizard, contrato, drawer) e os componentes (StatusBadge, Stepper, ContractRow) invocando `frontend-design` / `ui-ux-pro-max` / `web-design-guidelines`. Aterre na identidade B2 (teal/areia, Space Grotesk, status semânticos), foco/teclado no drawer (Radix já ajuda), e alvos de toque no mobile. **Não** altere props/contratos cobertos pelos testes — refine apenas o visual. Rode os testes após cada ajuste.
Run após ajustes: `bun --filter @quitto/web test && bun --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 2: Suíte + lint + typecheck + build (monorepo)**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: tudo verde (API + shared + web; testes do web incluindo os novos + o spike de tipos do Eden).

- [ ] **Step 3: Smoke manual (opcional, recomendado)**

Com Postgres e a API de pé (`bun --filter @quitto/api dev`) e o front (`bun --filter @quitto/web dev`), faça login, crie um contrato (auto), veja a lista, abra o detalhe, edite uma parcela pelo drawer e confirme o toast/atualização. (Não bloqueia o merge; os testes cobrem o comportamento.)

- [ ] **Step 4: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff feat/fase-2b-contratos-ui -m "Merge da Fase 2b (contratos UI) em develop"
```

- [ ] **Step 5: Atualizar o ROADMAP**

Marque a Fase 2b como concluída em `docs/superpowers/ROADMAP.md` (linha **2b**), depois:
```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca a Fase 2b (contratos UI) como concluída"
```

---

## Self-Review (cobertura do spec)

- **Lista de contratos (layout linhas largas, progresso, atrasadas, vazio):** Task 8 ✅
- **Criar contrato (wizard 2 passos, stepper, auto/custom, RHF FormProvider, navegação sem perda):** Task 9 ✅
- **Tela de contrato (stats + barra + participantes + parcelas, coluna única):** Task 10 ✅
- **Drawer da parcela (ver→editar, owner edita valor/vencimento, não-owner só leitura, nota Fase 3):** Task 11 ✅
- **apiClient/ApiError + toasts globais + error boundary + map de erro:** Tasks 4, 5 ✅
- **Query hooks + keys + prefetch via loaders + invalidação alvo:** Tasks 6, 8, 10 ✅
- **Schemas Zod em @quitto/shared + RHF:** Tasks 3, 9, 11 ✅
- **Helpers de dinheiro/data:** Task 2 ✅
- **Responsivo + bottom-nav + item Contratos:** Task 12 ✅
- **Diretriz de design (skills) por tela:** embutida nas Tasks 7-12 e na Task 13 (passada final) ✅
- **Testes (Vitest + Testing Library) + setup:** Task 1 e specs por tarefa ✅
- **Estado: useState local / RHF; nunca Context API; Zustand só se necessário:** seguido (nenhuma tarefa adiciona Zustand) ✅
- **Fora de escopo (comprovantes/auditoria F3, convites F4, notificações F5, dashboard/export F6):** respeitado; drawer só sinaliza "em breve" ✅
- **Lacuna "próxima parcela" na lista:** decisão (a) do spec §15 — deixada de fora; a lista usa só os campos do GET /contracts ✅

> **Notas de tipo/execução:** (1) o tipo das respostas do Eden traz enums como `string`; por isso `StatusBadge` (Task 7) já aceita `string` e mapeia desconhecido→neutro — sem casts. (2) Os mocks de `@/lib/api` e do `@tanstack/react-router` nos testes devem refletir o shape real do treaty/hooks — ajuste o objeto do mock se o uso divergir, mantendo as asserções. (3) Se o `button.tsx` não exporta `asChild`/`buttonVariants`, use o que existir para os links-botão (Task 8). (4) Confirme o caminho do `from` em `useParams` da Task 10 (`/protected/contracts/$id`) contra a árvore real do TanStack Router; ajuste se o id da rota protegida gerar outro caminho.
