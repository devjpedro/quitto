# Fase 6a — Dashboard (visão geral) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o placeholder de `/` por uma visão geral acionável: a pagar / a receber / atrasadas / contratos ativos + lista de próximas parcelas com deep-link pro drawer — alimentada por um endpoint de agregação no servidor.

**Architecture:** Agregação pura e testável em `lib/dashboard.ts` (`computeDashboard`), exposta por `GET /api/dashboard` que coleta os contratos/parcelas/vagas do usuário e chama a função pura. Front fino: `use-dashboard.ts` (TanStack Query) + `dashboard.tsx`. Cada parcela é classificada pela vaga do usuário (buyer→pagar, seller→receber); viewer fica de fora.

**Tech Stack:** Bun + Elysia + Drizzle/Postgres (`bun test`); React 19 + Vite, TanStack Router/Query, Vitest + testing-library; `@quitto/shared` (`isPaidStatus`, `isOverdue`).

**Spec:** `docs/superpowers/specs/2026-06-13-fase-6a-dashboard-design.md`

**Git:** branch `feat/fase-6a-dashboard` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 6a no ROADMAP.

**Pré-requisitos:** Postgres (`DATABASE_URL`) para os testes de integração da API.

**Convenções:** código/identificadores em inglês; textos de UI em pt-BR; sem literais (use `INSTALLMENT_STATUS`/predicados e `DIRECTION_LABEL`); UI com `frontend-design` (B2, sem cara genérica); sem comentários óbvios.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/lib/dashboard.ts` (criar) | `computeDashboard` (puro) + tipos |
| `apps/api/src/modules/dashboard.ts` (criar) | `GET /api/dashboard` |
| `apps/api/src/app.ts` (modificar) | registrar `dashboardModule` |
| `apps/api/tests/dashboard.test.ts` (criar) | unit do puro + integração do endpoint |
| `apps/web/src/hooks/use-dashboard.ts` (criar) | `dashboardQueryOptions` + `useDashboardQuery` |
| `apps/web/src/lib/query-keys.ts` (modificar) | `dashboard` |
| `apps/web/src/lib/labels.ts` (modificar) | `DIRECTION_LABEL` |
| `apps/web/src/routes/dashboard.tsx` (modificar) | a página (substitui o placeholder) |
| `apps/web/src/router.tsx` (modificar) | `loader` da rota `/` |
| `apps/web/tests/use-dashboard.test.tsx` (criar) | hook |
| `apps/web/tests/dashboard-page.test.tsx` (criar) | página |

---

## Task 1: Agregação pura `computeDashboard`

**Files:**
- Create: `apps/api/src/lib/dashboard.ts`
- Test: `apps/api/tests/dashboard.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/tests/dashboard.test.ts` (parte 1 — puro):

```ts
import { describe, expect, it } from "bun:test";
import { computeDashboard, type DashboardContractInput } from "../src/lib/dashboard";

const today = "2026-06-13";

const inst = (over: Partial<DashboardContractInput["installments"][number]> = {}) => ({
  id: "i",
  sequence: 1,
  amountCents: 1000,
  dueDate: "2026-07-10",
  status: "pending" as const,
  ...over,
});

describe("computeDashboard", () => {
  it("classifies open installments by the user's slot", () => {
    const out = computeDashboard(
      [
        { contractId: "c1", title: "Aluguel", userSlot: "buyer", status: "active", installments: [inst({ amountCents: 500 })] },
        { contractId: "c2", title: "Venda", userSlot: "seller", status: "active", installments: [inst({ amountCents: 700 })] },
      ],
      today
    );
    expect(out.toPayCents).toBe(500);
    expect(out.toReceiveCents).toBe(700);
  });

  it("excludes paid installments from the open totals", () => {
    const out = computeDashboard(
      [{ contractId: "c1", title: "C", userSlot: "buyer", status: "active", installments: [inst({ status: "paid" }), inst({ amountCents: 300 })] }],
      today
    );
    expect(out.toPayCents).toBe(300);
  });

  it("counts and sums overdue open installments", () => {
    const out = computeDashboard(
      [{ contractId: "c1", title: "C", userSlot: "buyer", status: "active", installments: [inst({ amountCents: 400, dueDate: "2026-06-01" })] }],
      today
    );
    expect(out.overdueCount).toBe(1);
    expect(out.overdueCents).toBe(400);
  });

  it("ignores viewer contracts entirely", () => {
    const out = computeDashboard(
      [{ contractId: "c1", title: "C", userSlot: "viewer", status: "active", installments: [inst({ amountCents: 999, dueDate: "2026-06-01" })] }],
      today
    );
    expect(out.toPayCents).toBe(0);
    expect(out.toReceiveCents).toBe(0);
    expect(out.overdueCount).toBe(0);
    expect(out.activeContractsCount).toBe(0);
    expect(out.upcoming).toEqual([]);
  });

  it("builds upcoming sorted by dueDate (overdue first), capped at 5", () => {
    const installments = [
      inst({ id: "a", dueDate: "2026-08-10" }),
      inst({ id: "b", dueDate: "2026-06-01" }),
      inst({ id: "c", dueDate: "2026-07-01" }),
      inst({ id: "d", dueDate: "2026-09-01" }),
      inst({ id: "e", dueDate: "2026-10-01" }),
      inst({ id: "f", dueDate: "2026-11-01" }),
    ];
    const out = computeDashboard(
      [{ contractId: "c1", title: "C", userSlot: "buyer", status: "active", installments }],
      today
    );
    expect(out.upcoming).toHaveLength(5);
    expect(out.upcoming[0]?.id).toBe("b");
    expect(out.upcoming[0]?.isOverdue).toBe(true);
    expect(out.upcoming[0]?.direction).toBe("pay");
  });

  it("counts active and completed contracts where the user is a party", () => {
    const out = computeDashboard(
      [
        { contractId: "c1", title: "A", userSlot: "buyer", status: "active", installments: [] },
        { contractId: "c2", title: "B", userSlot: "seller", status: "completed", installments: [] },
        { contractId: "c3", title: "C", userSlot: "viewer", status: "active", installments: [] },
      ],
      today
    );
    expect(out.activeContractsCount).toBe(1);
    expect(out.completedContractsCount).toBe(1);
  });
});
```

(O `id` no item de `upcoming` é prático para o teste; mantenha-o no shape de saída.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dashboard.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/dashboard").

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/dashboard.ts`:

```ts
import {
  type ContractStatus,
  CONTRACT_STATUS,
  type InstallmentStatus,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";

export type DashboardSlot = "buyer" | "seller" | "viewer";

export interface DashboardContractInput {
  contractId: string;
  title: string;
  userSlot: DashboardSlot;
  status: ContractStatus;
  installments: {
    id: string;
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: InstallmentStatus;
  }[];
}

export interface UpcomingInstallment {
  id: string;
  contractId: string;
  contractTitle: string;
  sequence: number;
  amountCents: number;
  dueDate: string;
  direction: "pay" | "receive";
  isOverdue: boolean;
}

export interface DashboardSummary {
  toPayCents: number;
  toReceiveCents: number;
  overdueCount: number;
  overdueCents: number;
  activeContractsCount: number;
  completedContractsCount: number;
  upcoming: UpcomingInstallment[];
}

const UPCOMING_LIMIT = 5;

export function computeDashboard(
  contracts: DashboardContractInput[],
  todayISO: string
): DashboardSummary {
  const summary: DashboardSummary = {
    toPayCents: 0,
    toReceiveCents: 0,
    overdueCount: 0,
    overdueCents: 0,
    activeContractsCount: 0,
    completedContractsCount: 0,
    upcoming: [],
  };
  const upcoming: UpcomingInstallment[] = [];

  for (const c of contracts) {
    if (c.userSlot === "viewer") {
      continue;
    }
    if (c.status === CONTRACT_STATUS.active) {
      summary.activeContractsCount += 1;
    } else if (c.status === CONTRACT_STATUS.completed) {
      summary.completedContractsCount += 1;
    }
    const direction = c.userSlot === "buyer" ? "pay" : "receive";

    for (const it of c.installments) {
      if (isPaidStatus(it.status)) {
        continue;
      }
      if (direction === "pay") {
        summary.toPayCents += it.amountCents;
      } else {
        summary.toReceiveCents += it.amountCents;
      }
      const overdue = isOverdue(it.dueDate, it.status, todayISO);
      if (overdue) {
        summary.overdueCount += 1;
        summary.overdueCents += it.amountCents;
      }
      upcoming.push({
        id: it.id,
        contractId: c.contractId,
        contractTitle: c.title,
        sequence: it.sequence,
        amountCents: it.amountCents,
        dueDate: it.dueDate,
        direction,
        isOverdue: overdue,
      });
    }
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  summary.upcoming = upcoming.slice(0, UPCOMING_LIMIT);
  return summary;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dashboard.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/dashboard.ts apps/api/tests/dashboard.test.ts
git commit -m "feat(api): computeDashboard puro (a pagar/receber, atraso, upcoming)"
```

---

## Task 2: Endpoint `GET /api/dashboard`

**Files:**
- Create: `apps/api/src/modules/dashboard.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/dashboard.test.ts` (parte 2 — integração)

- [ ] **Step 1: Escrever os testes de integração que falham**

Em `apps/api/tests/dashboard.test.ts`, adicione (reusando o harness de signup/createContract dos outros testes — copie `signUpCookie` e `createContract` de `tests/payments.test.ts`):

```ts
import { app } from "../src/app";

// ── cole signUpCookie + createContract de tests/payments.test.ts ──

describe("GET /api/dashboard", () => {
  it("requires auth", async () => {
    const res = await app.handle(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(401);
  });

  it("aggregates only the caller's contracts (buyer → a pagar)", async () => {
    const cookie = await signUpCookie("dash-buyer");
    await createContract(cookie, false); // ownerRole buyer, 3 parcelas de 1000 = 3000

    const res = await app.handle(
      new Request("http://localhost/api/dashboard", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toPayCents).toBe(3000);
    expect(body.toReceiveCents).toBe(0);
    expect(body.activeContractsCount).toBe(1);
    expect(body.upcoming.length).toBeGreaterThan(0);
    expect(body.upcoming[0].direction).toBe("pay");
  });

  it("does not leak other users' contracts", async () => {
    const other = await signUpCookie("dash-other");
    await createContract(other, false);
    const mine = await signUpCookie("dash-mine");

    const res = await app.handle(
      new Request("http://localhost/api/dashboard", { headers: { cookie: mine } })
    );
    const body = await res.json();
    expect(body.toPayCents).toBe(0);
    expect(body.activeContractsCount).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dashboard.test.ts`
Expected: FAIL (rota 404/401 inexistente; `toPayCents` indefinido).

- [ ] **Step 3: Implementar o módulo**

Crie `apps/api/src/modules/dashboard.ts`:

```ts
import { eq, inArray, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { ContractStatus, InstallmentStatus } from "@quitto/shared";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import {
  computeDashboard,
  type DashboardContractInput,
  type DashboardSlot,
} from "../lib/dashboard";
import { requireAuth } from "../lib/session";

function slotFor(
  role: string | undefined,
  isOwner: boolean,
  ownerRole: string
): DashboardSlot {
  if (role === "buyer" || role === "seller") {
    return role;
  }
  if (isOwner && (ownerRole === "buyer" || ownerRole === "seller")) {
    return ownerRole;
  }
  return "viewer";
}

export const dashboardModule = new Elysia({ prefix: "/api" }).get(
  "/dashboard",
  async ({ request }) => {
    const { user } = await requireAuth(request.headers);

    const linked = await db
      .select({ contractId: participant.contractId, role: participant.role })
      .from(participant)
      .where(eq(participant.linkedUserId, user.id));
    const roleByContract = new Map(linked.map((l) => [l.contractId, l.role]));
    const linkedIds = linked.map((l) => l.contractId);

    const rows = await db
      .select()
      .from(contract)
      .where(
        linkedIds.length > 0
          ? or(eq(contract.ownerId, user.id), inArray(contract.id, linkedIds))
          : eq(contract.ownerId, user.id)
      );
    if (rows.length === 0) {
      return computeDashboard([], new Date().toISOString().slice(0, 10));
    }

    const ids = rows.map((r) => r.id);
    const items = await db
      .select()
      .from(installment)
      .where(inArray(installment.contractId, ids));
    const today = new Date().toISOString().slice(0, 10);

    const inputs: DashboardContractInput[] = rows.map((c) => ({
      contractId: c.id,
      title: c.title,
      userSlot: slotFor(
        roleByContract.get(c.id),
        c.ownerId === user.id,
        c.ownerRole
      ),
      status: c.status as ContractStatus,
      installments: items
        .filter((it) => it.contractId === c.id)
        .map((it) => ({
          id: it.id,
          sequence: it.sequence,
          amountCents: it.amountCents,
          dueDate: it.dueDate,
          status: it.status as InstallmentStatus,
        })),
    }));

    return computeDashboard(inputs, today);
  },
  {
    response: t.Object({
      toPayCents: t.Integer(),
      toReceiveCents: t.Integer(),
      overdueCount: t.Integer(),
      overdueCents: t.Integer(),
      activeContractsCount: t.Integer(),
      completedContractsCount: t.Integer(),
      upcoming: t.Array(
        t.Object({
          id: t.String(),
          contractId: t.String(),
          contractTitle: t.String(),
          sequence: t.Integer(),
          amountCents: t.Integer(),
          dueDate: t.String(),
          direction: t.Union([t.Literal("pay"), t.Literal("receive")]),
          isOverdue: t.Boolean(),
        })
      ),
    }),
  }
);
```

- [ ] **Step 4: Registrar no `app.ts`**

Importe `import { dashboardModule } from "./modules/dashboard";` e adicione `.use(dashboardModule)` na cadeia de `buildApp()`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/dashboard.test.ts`
Expected: PASS (puro + integração).

- [ ] **Step 6: Typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/api typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/modules/dashboard.ts apps/api/src/app.ts apps/api/tests/dashboard.test.ts
git commit -m "feat(api): GET /api/dashboard (agrega contratos do usuário)"
```

---

## Task 3: Query key, labels e hook do dashboard (web)

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Modify: `apps/web/src/lib/labels.ts`
- Create: `apps/web/src/hooks/use-dashboard.ts`
- Test: `apps/web/tests/use-dashboard.test.tsx`

- [ ] **Step 1: Adicionar a query key**

Em `apps/web/src/lib/query-keys.ts`, adicione `dashboard: ["dashboard"] as const,` ao objeto `queryKeys`.

- [ ] **Step 2: Adicionar `DIRECTION_LABEL`**

Em `apps/web/src/lib/labels.ts`, adicione:

```ts
export const DIRECTION_LABEL: Record<"pay" | "receive", string> = {
  pay: "a pagar",
  receive: "a receber",
};
```

- [ ] **Step 3: Escrever o teste do hook que falha**

Crie `apps/web/tests/use-dashboard.test.tsx` (padrão de `use-contracts.test.tsx`):

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getDashboard = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { api: { dashboard: { get: () => getDashboard() } } },
}));

import { useDashboardQuery } from "../src/hooks/use-dashboard";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useDashboardQuery", () => {
  beforeEach(() => getDashboard.mockReset());

  it("unwraps the summary", async () => {
    getDashboard.mockResolvedValue({
      data: {
        toPayCents: 500,
        toReceiveCents: 0,
        overdueCount: 0,
        overdueCents: 0,
        activeContractsCount: 1,
        completedContractsCount: 0,
        upcoming: [],
      },
      error: null,
    });
    const { result } = renderHook(() => useDashboardQuery(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.toPayCents).toBe(500);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-dashboard.test.tsx`
Expected: FAIL ("Cannot find module ../src/hooks/use-dashboard").

- [ ] **Step 5: Implementar o hook**

Crie `apps/web/src/hooks/use-dashboard.ts`:

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const dashboardQueryOptions = queryOptions({
  queryKey: queryKeys.dashboard,
  queryFn: () => unwrap(api.api.dashboard.get()),
});

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/use-dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/query-keys.ts apps/web/src/lib/labels.ts apps/web/src/hooks/use-dashboard.ts apps/web/tests/use-dashboard.test.tsx
git commit -m "feat(web): hook + labels do dashboard"
```

---

## Task 4: Página do dashboard

**Files:**
- Modify: `apps/web/src/routes/dashboard.tsx`
- Modify: `apps/web/src/router.tsx`
- Test: `apps/web/tests/dashboard-page.test.tsx`

Use `frontend-design` (B2). Os valores monetários usam `formatBRL`; datas `formatISODateBR`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/tests/dashboard-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const dashboard = {
  toPayCents: 150_000,
  toReceiveCents: 0,
  overdueCount: 1,
  overdueCents: 50_000,
  activeContractsCount: 2,
  completedContractsCount: 0,
  upcoming: [
    {
      id: "i1",
      contractId: "c1",
      contractTitle: "Aluguel",
      sequence: 3,
      amountCents: 50_000,
      dueDate: "2026-06-01",
      direction: "pay",
      isOverdue: true,
    },
  ],
};

const mockData = { data: dashboard, isPending: false };
vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardQuery: () => mockData,
}));

import { DashboardPage } from "../src/routes/dashboard";

describe("DashboardPage", () => {
  it("renders the stat values and the upcoming list", () => {
    render(<DashboardPage />);
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument(); // a pagar
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("deep-links to the installment when an upcoming item is clicked", async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByRole("button", { name: /aluguel/i }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });
});
```

E um teste de empty state, num segundo arquivo ou ajustando o mock:

```tsx
// dentro do mesmo arquivo, sobrescrevendo o mock para um caso vazio:
it("shows the empty state with a CTA when there are no contracts", () => {
  mockData.data = {
    toPayCents: 0,
    toReceiveCents: 0,
    overdueCount: 0,
    overdueCents: 0,
    activeContractsCount: 0,
    completedContractsCount: 0,
    upcoming: [],
  };
  render(<DashboardPage />);
  expect(screen.getByText(/criar contrato/i)).toBeInTheDocument();
});
```

(Como `mockData` é mutável e o vi.mock fecha sobre ele, ordene o caso vazio por último ou reatribua `mockData.data` no início de cada `it`. Para robustez, reatribua o objeto completo no começo dos dois primeiros testes.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/dashboard-page.test.tsx`
Expected: FAIL (placeholder atual não tem os valores nem a lista).

- [ ] **Step 3: Implementar a página**

Substitua `apps/web/src/routes/dashboard.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardQuery } from "@/hooks/use-dashboard";
import { formatBRL, formatISODateBR } from "@/lib/format";
import { DIRECTION_LABEL } from "@/lib/labels";

function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-xs ${
        alert ? "border-red-200" : "border-border"
      }`}
    >
      <p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 font-bold font-display text-xl tabular-nums ${
          alert ? "text-red-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isPending } = useDashboardQuery();

  if (isPending || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-9 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasContracts =
    data.activeContractsCount + data.completedContractsCount > 0;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 font-bold font-display text-2xl">Dashboard</h1>

      {hasContracts ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="A receber" value={formatBRL(data.toReceiveCents)} />
            <StatCard label="A pagar" value={formatBRL(data.toPayCents)} />
            <StatCard
              alert={data.overdueCount > 0}
              hint={formatBRL(data.overdueCents)}
              label="Atrasadas"
              value={String(data.overdueCount)}
            />
            <StatCard
              label="Contratos ativos"
              value={String(data.activeContractsCount)}
            />
          </div>

          <h2 className="mt-8 mb-3 font-display font-semibold text-lg">
            Próximas parcelas
          </h2>
          {data.upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma parcela em aberto.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              {data.upcoming.map((u) => (
                <li className="border-border border-b last:border-0" key={u.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                    onClick={() =>
                      navigate({
                        to: "/contracts/$id",
                        params: { id: u.contractId },
                        search: { installment: u.id },
                      })
                    }
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground text-sm">
                        {u.contractTitle}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Parcela {u.sequence} · {DIRECTION_LABEL[u.direction]} ·{" "}
                        {formatISODateBR(u.dueDate)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {u.isOverdue ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-[10px] text-red-700">
                          vencida
                        </span>
                      ) : null}
                      <span className="font-semibold text-sm tabular-nums">
                        {formatBRL(u.amountCents)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border border-dashed bg-card p-10 text-center">
          <p className="mb-4 text-muted-foreground">
            Você ainda não tem contratos.
          </p>
          <button
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
            onClick={() => navigate({ to: "/contracts/new" })}
            type="button"
          >
            Criar contrato
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Adicionar o `loader` à rota `/`**

Em `apps/web/src/router.tsx`, importe `dashboardQueryOptions` de `./hooks/use-dashboard` e adicione o `loader` à `dashboardRoute`:

```ts
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  loader: () => queryClient.ensureQueryData(dashboardQueryOptions),
  component: DashboardPage,
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/dashboard-page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/dashboard.tsx apps/web/src/router.tsx apps/web/tests/dashboard-page.test.tsx
git commit -m "feat(web): página do dashboard (stats + próximas parcelas + empty state)"
```

---

## Task 5: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte da API**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test`
Expected: tudo verde (storage/payments exigem MinIO + envs S3; o resto não).

- [ ] **Step 2: Suíte do web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: tudo verde.

- [ ] **Step 3: Typecheck + lint do monorepo**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 4: Smoke manual (dev)**

Suba o stack (`bun run dev`) com pelo menos um contrato criado e confira: os cards mostram a
pagar/receber/atrasadas/ativos coerentes; clicar numa próxima parcela abre o drawer da parcela
certa; sem contratos, aparece o empty state com o CTA.

- [ ] **Step 5: Marcar a 6a no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, divida a linha **6** em **6a/6b/6c** (ou edite a célula da 6
para refletir o fatiamento) e marque a **6a** como concluída:
`` | **6a** | Dashboard (visão geral) | A pagar/receber, atrasadas, contratos ativos, próximas parcelas com deep-link. Endpoint de agregação `GET /api/dashboard`. | `plans/2026-06-13-fase-6a-dashboard.md` ✅ **concluído** (merge em `develop`; suite verde — computeDashboard puro + endpoint escopado + página com deep-link) | ``
e deixe 6b (PDF/export) e 6c (LGPD) como "a escrever".

- [ ] **Step 6: Commit do roadmap**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 6a concluída + fatia a Fase 6 (6a/6b/6c)"
```

- [ ] **Step 7: Merge em `develop`**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git checkout develop
git merge --no-ff feat/fase-6a-dashboard -m "Merge: Fase 6a — dashboard"
```

Expected: merge limpo; suites verdes em `develop`.

---

## Notas para o executor

- **Eden:** `api.api.dashboard.get()`. O response tipado faz o Eden tipar o resumo cross-package.
- **Sem literais:** use `isPaidStatus`/`isOverdue` (já importados em `@quitto/shared`) e
  `DIRECTION_LABEL`; nada de comparar status com string crua.
- **Deep-link:** reusa o `?installment=` validado pela 5b na rota `/contracts/$id` — nada novo no
  router além do `loader` do dashboard.
- **Design B2:** invoque `frontend-design` ao montar a página (cards/lista/empty). Foco visível,
  rótulos textuais nos cards (não só cor), `tabular-nums` nos valores.
- **Harness de teste da API:** reuse `signUpCookie`/`createContract` de `tests/payments.test.ts`
  (não reinvente). `createContract(cookie, false)` cria 3 parcelas de 1000 com `ownerRole: buyer`.
