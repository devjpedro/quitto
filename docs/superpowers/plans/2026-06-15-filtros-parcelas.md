# Filtros + "carregar mais" na lista de parcelas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Substituir a lista única de parcelas da tela de contrato por chips de filtro (Todas / A pagar / Atrasadas / Pagas) + "carregar mais", resolvendo o scroll e a relevância — tudo no frontend, sem mudança de comportamento do backend.

**Architecture:** Um helper puro (`lib/installments-filter.ts`) faz filtragem/contagem reusando os predicados de domínio do `@quitto/shared` (`isPaidStatus`/`isOverdue`). Um componente novo (`components/installments-section.tsx`) detém o estado local de filtro + janela visível e renderiza chips/lista/"carregar mais". O `contract-detail.tsx` apenas consome o componente; o drawer e o deep-link de parcela ficam inalterados (continuam lendo da lista completa).

**Tech Stack:** React 19, TanStack (já existente), Vitest + Testing Library, biome. `@quitto/shared` para predicados.

**Spec:** `docs/superpowers/specs/2026-06-15-filtros-parcelas-design.md`

**Git:** branch `feat/filtros-parcelas` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop`.

**Convenções:** código em inglês; sem mudança de API/Eden/tipos; default cronológico; YAGNI (sem páginas numeradas, sem virtualização).

## File Structure

- **Create** `apps/web/src/lib/installments-filter.ts` — lógica pura de filtro/contagem. Sem React.
- **Create** `apps/web/tests/installments-filter.test.ts` — unit do helper.
- **Create** `apps/web/src/components/installments-section.tsx` — UI da seção Parcelas (chips + lista + carregar mais), estado local.
- **Create** `apps/web/tests/installments-section.test.tsx` — testes de componente.
- **Modify** `apps/web/src/lib/labels.ts` — adiciona `INSTALLMENT_FILTER_LABEL` e `INSTALLMENT_FILTER_EMPTY`.
- **Modify** `apps/web/src/routes/contract-detail.tsx` — troca o `<section>` de parcelas pelo `<InstallmentsSection>`; remove imports que migraram.

---

## Task 1: Helper puro de filtro/contagem

**Files:**
- Create: `apps/web/src/lib/installments-filter.ts`
- Test: `apps/web/tests/installments-filter.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/tests/installments-filter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  countByFilter,
  filterInstallments,
} from "../src/lib/installments-filter";

const TODAY = "2026-06-15";

// Cobre cada bucket: pagas (paid/confirmed), a pagar (pending/awaiting/disputed),
// atrasada (vencida + não paga + não awaiting).
const items = [
  { id: "a", dueDate: "2026-01-10", status: "paid" }, // paga
  { id: "b", dueDate: "2026-02-10", status: "confirmed" }, // paga
  { id: "c", dueDate: "2026-05-10", status: "pending" }, // atrasada (passada, não paga)
  { id: "d", dueDate: "2026-07-10", status: "pending" }, // a pagar, futura (não atrasada)
  { id: "e", dueDate: "2026-04-10", status: "awaiting_confirmation" }, // a pagar, NÃO atrasada
  { id: "f", dueDate: "2026-03-10", status: "disputed" }, // atrasada (passada, não paga, não awaiting)
];

function ids(list: { id: string }[]) {
  return list.map((x) => x.id);
}

describe("filterInstallments", () => {
  it("all → todos", () => {
    expect(ids(filterInstallments(items, "all", TODAY))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("paid → só pagas", () => {
    expect(ids(filterInstallments(items, "paid", TODAY))).toEqual(["a", "b"]);
  });

  it("due → tudo que não está pago", () => {
    expect(ids(filterInstallments(items, "due", TODAY))).toEqual([
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("overdue → vencidas, não pagas e não awaiting", () => {
    expect(ids(filterInstallments(items, "overdue", TODAY))).toEqual([
      "c",
      "f",
    ]);
  });
});

describe("countByFilter", () => {
  it("conta cada bucket", () => {
    expect(countByFilter(items, TODAY)).toEqual({
      all: 6,
      due: 4,
      overdue: 2,
      paid: 2,
    });
  });

  it("invariante: due + paid === all", () => {
    const c = countByFilter(items, TODAY);
    expect(c.due + c.paid).toBe(c.all);
  });

  it("invariante: overdue ⊆ due", () => {
    const c = countByFilter(items, TODAY);
    expect(c.overdue).toBeLessThanOrEqual(c.due);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/installments-filter.test.ts`
Expected: FAIL (módulo `../src/lib/installments-filter` não existe).

- [ ] **Step 3: Implementar o helper**

`apps/web/src/lib/installments-filter.ts`:
```ts
import { isOverdue, isPaidStatus } from "@quitto/shared";

export type InstallmentFilter = "all" | "due" | "overdue" | "paid";

type FilterableInstallment = { dueDate: string; status: string };

export function matchesFilter(
  item: FilterableInstallment,
  filter: InstallmentFilter,
  todayISO: string
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "due":
      return !isPaidStatus(item.status);
    case "overdue":
      return isOverdue(item.dueDate, item.status, todayISO);
    case "paid":
      return isPaidStatus(item.status);
  }
}

export function filterInstallments<T extends FilterableInstallment>(
  items: T[],
  filter: InstallmentFilter,
  todayISO: string
): T[] {
  return items.filter((it) => matchesFilter(it, filter, todayISO));
}

export function countByFilter(
  items: FilterableInstallment[],
  todayISO: string
): Record<InstallmentFilter, number> {
  const counts: Record<InstallmentFilter, number> = {
    all: items.length,
    due: 0,
    overdue: 0,
    paid: 0,
  };
  for (const it of items) {
    if (isPaidStatus(it.status)) {
      counts.paid += 1;
    } else {
      counts.due += 1;
    }
    if (isOverdue(it.dueDate, it.status, todayISO)) {
      counts.overdue += 1;
    }
  }
  return counts;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/installments-filter.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/installments-filter.ts apps/web/tests/installments-filter.test.ts
git commit -m "feat(web): helper puro de filtro/contagem de parcelas"
```

---

## Task 2: Componente `InstallmentsSection` (chips + lista + carregar mais)

**Files:**
- Modify: `apps/web/src/lib/labels.ts`
- Create: `apps/web/src/components/installments-section.tsx`
- Test: `apps/web/tests/installments-section.test.tsx`

- [ ] **Step 1: Adicionar labels em `lib/labels.ts`**

No topo de `apps/web/src/lib/labels.ts`, adicione o import de tipo (junto aos imports existentes):
```ts
import type { InstallmentFilter } from "./installments-filter";
```

E adicione ao final do arquivo:
```ts
export const INSTALLMENT_FILTER_LABEL: Record<InstallmentFilter, string> = {
  all: "Todas",
  due: "A pagar",
  overdue: "Atrasadas",
  paid: "Pagas",
};

export const INSTALLMENT_FILTER_EMPTY: Record<InstallmentFilter, string> = {
  all: "Nenhuma parcela.",
  due: "Tudo quitado por aqui.",
  overdue: "Nenhuma parcela atrasada.",
  paid: "Nenhuma parcela paga ainda.",
};
```

- [ ] **Step 2: Escrever o teste de componente que falha**

`apps/web/tests/installments-section.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InstallmentsSection } from "../src/components/installments-section";

// 2 pagas, 1 atrasada (pending vencida), o resto futuras (a pagar) → 18 no total.
function makeInstallments() {
  const list = [
    { id: "p1", sequence: 1, amountCents: 1000, dueDate: "2026-01-10", status: "paid" },
    { id: "p2", sequence: 2, amountCents: 1000, dueDate: "2026-02-10", status: "confirmed" },
    { id: "late", sequence: 3, amountCents: 1000, dueDate: "2026-05-10", status: "pending" },
  ];
  // 15 parcelas futuras (> hoje 2026-06-15) → "a pagar" e NÃO atrasadas.
  for (let i = 4; i <= 18; i++) {
    list.push({
      id: `f${i}`,
      sequence: i,
      amountCents: 1000,
      dueDate: "2027-01-10",
      status: "pending",
    });
  }
  return list;
}

// Fixar "hoje" para o cálculo de atrasada/overdue (a parcela #3 vence 2026-05-10).
vi.mock("../src/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/format")>();
  return { ...actual, todayISO: () => "2026-06-15" };
});

describe("InstallmentsSection", () => {
  it("default mostra Todas, com os 4 chips e contagens", () => {
    render(<InstallmentsSection installments={makeInstallments()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Todas \(18\)/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /Pagas \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atrasadas \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A pagar \(16\)/ })).toBeInTheDocument();
  });

  it("limita a 15 e mostra 'Carregar mais'; clicar revela o resto", () => {
    render(<InstallmentsSection installments={makeInstallments()} onSelect={vi.fn()} />);
    // 18 itens no filtro Todas → 15 visíveis + botão com 3 restantes
    expect(screen.getAllByTestId(/^installment-row-/)).toHaveLength(15);
    const more = screen.getByRole("button", { name: /Carregar mais \(3/ });
    fireEvent.click(more);
    expect(screen.getAllByTestId(/^installment-row-/)).toHaveLength(18);
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  });

  it("filtra ao clicar num chip e move o aria-pressed", () => {
    render(<InstallmentsSection installments={makeInstallments()} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Pagas \(2\)/ }));
    expect(screen.getByRole("button", { name: /Pagas \(2\)/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getAllByTestId(/^installment-row-/)).toHaveLength(2);
  });

  it("mostra empty state quando o filtro não tem itens", () => {
    const noOverdue = [
      { id: "p1", sequence: 1, amountCents: 1000, dueDate: "2026-01-10", status: "paid" },
    ];
    render(<InstallmentsSection installments={noOverdue} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Atrasadas \(0\)/ }));
    expect(screen.getByText("Nenhuma parcela atrasada.")).toBeInTheDocument();
  });

  it("não mostra 'Carregar mais' quando há ≤ 15 itens", () => {
    const few = makeInstallments().slice(0, 10);
    render(<InstallmentsSection installments={few} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  });

  it("chama onSelect com o id ao clicar numa linha", () => {
    const onSelect = vi.fn();
    render(<InstallmentsSection installments={makeInstallments()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("installment-row-p1"));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/installments-section.test.tsx`
Expected: FAIL (componente `installments-section` não existe).

- [ ] **Step 4: Implementar o componente**

`apps/web/src/components/installments-section.tsx`:
```tsx
import { isOverdue } from "@quitto/shared";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL, formatISODateBR, todayISO } from "@/lib/format";
import {
  countByFilter,
  filterInstallments,
  type InstallmentFilter,
} from "@/lib/installments-filter";
import {
  INSTALLMENT_FILTER_EMPTY,
  INSTALLMENT_FILTER_LABEL,
} from "@/lib/labels";

const PAGE_SIZE = 15;
const FILTER_ORDER: InstallmentFilter[] = ["all", "due", "overdue", "paid"];

interface Installment {
  amountCents: number;
  dueDate: string;
  id: string;
  sequence: number;
  status: string;
}

export function InstallmentsSection({
  installments,
  onSelect,
}: {
  installments: Installment[];
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<InstallmentFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const today = todayISO();

  const counts = countByFilter(installments, today);
  const filtered = filterInstallments(installments, filter, today).sort(
    (a, b) => a.sequence - b.sequence
  );
  const shown = filtered.slice(0, visibleCount);
  const remaining = filtered.length - shown.length;

  function selectFilter(next: InstallmentFilter) {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section>
      <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parcelas
      </h2>

      <div aria-label="Filtrar parcelas" className="mb-3 flex flex-wrap gap-2" role="group">
        {FILTER_ORDER.map((key) => {
          const active = key === filter;
          return (
            <button
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary/20 bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              key={key}
              onClick={() => selectFilter(key)}
              type="button"
            >
              {INSTALLMENT_FILTER_LABEL[key]} ({counts[key]})
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        Mostrando {filtered.length} {INSTALLMENT_FILTER_LABEL[filter].toLowerCase()}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed bg-card p-6 text-center text-muted-foreground text-sm">
          {INSTALLMENT_FILTER_EMPTY[filter]}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((it) => {
            const late = isOverdue(it.dueDate, it.status, today);
            return (
              <li key={it.id}>
                <button
                  className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  data-testid={`installment-row-${it.id}`}
                  onClick={() => onSelect(it.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${late ? "bg-destructive/70" : "bg-primary/40"}`}
                  />
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display font-semibold text-foreground text-xs tabular-nums">
                    {it.sequence}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground text-sm tabular-nums">
                    {formatISODateBR(it.dueDate)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display font-semibold text-foreground text-sm tabular-nums">
                    {formatBRL(it.amountCents)}
                  </span>
                  <StatusBadge overdue={late} status={it.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {remaining > 0 ? (
        <button
          className="mt-3 w-full rounded-lg border border-border py-2 text-muted-foreground text-sm transition-colors hover:bg-muted"
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          type="button"
        >
          Carregar mais ({remaining} {remaining === 1 ? "restante" : "restantes"})
        </button>
      ) : null}
    </section>
  );
}
```

Nota: biome pode reordenar imports no pre-commit; tudo bem. Não há regex inline (sem risco de `useTopLevelRegex`).

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/installments-section.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/lib/labels.ts apps/web/src/components/installments-section.tsx apps/web/tests/installments-section.test.tsx
git commit -m "feat(web): InstallmentsSection com chips de filtro + carregar mais"
```

---

## Task 3: Ligar no `contract-detail.tsx` + regressão

**Files:**
- Modify: `apps/web/src/routes/contract-detail.tsx`

- [ ] **Step 1: Substituir a `<section>` de parcelas pelo componente**

Em `apps/web/src/routes/contract-detail.tsx`, troque TODO o bloco da seção de parcelas (de `<section>` com o `<h2>Parcelas` até o `</section>` correspondente — hoje o `<section>` que contém `installments.map(...)`) por:
```tsx
      <InstallmentsSection installments={installments} onSelect={setOpenId} />
```

- [ ] **Step 2: Atualizar imports (remover os que migraram)**

No topo de `contract-detail.tsx`:
1. **Remova** a linha `import { isOverdue } from "@quitto/shared";` (só era usada na lista de parcelas).
2. **Troque** `import { formatBRL, formatISODateBR, todayISO } from "@/lib/format";` por
   `import { formatBRL } from "@/lib/format";` (`formatISODateBR`/`todayISO` só eram usados na lista).
3. **Remova** `import { StatusBadge } from "@/components/status-badge";` (só usado na lista).
4. **Adicione** `import { InstallmentsSection } from "@/components/installments-section";`.

(O `setOpenId`, `openId`, `selected = installments.find(...)`, `closeInstallment`, e o `<InstallmentDrawer>` ficam inalterados — o deep-link via search param continua lendo da lista completa.)

- [ ] **Step 3: Typecheck (pega import morto / tipo)**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`
Expected: PASS (sem "is declared but never used", sem erro de tipo em `onSelect={setOpenId}`).

- [ ] **Step 4: Suíte web + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: PASS — os testes de `contract-detail` usam 2 parcelas (< 15), então seguem verdes; os novos testes (helper + section) passam.
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx biome check .`
Expected: limpo (sem erros).

- [ ] **Step 5: E2E de regressão (com pg + minio de pé)**

Pré-requisito: `cd /home/buckz/Documentos/www/personal-projects/quitto && docker compose up -d`.
Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/e2e && bun run e2e`
Expected: PASS — o `data-testid="installment-row-<id>"` foi preservado; o portão axe da 7c não acusa novas violações (chips são `button` com `aria-pressed` num `role="group"` rotulado). Os contratos seeded no e2e têm poucas parcelas (< 15, filtro default "Todas"), então as linhas clicadas continuam visíveis.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/routes/contract-detail.tsx
git commit -m "feat(web): contract-detail usa InstallmentsSection (filtros nas parcelas)"
```

---

## Notas para o executor

- **Sem mudança de backend/comportamento de dados:** o resumo (Total/Pago/%/Atrasadas) segue calculado no servidor sobre todas as parcelas; a contagem `Atrasadas` do chip usa o mesmo `isOverdue` por linha que a UI já usava, então bate com o stat do resumo.
- **Deep-link:** abrir o drawer de uma parcela (via notificação) é independente do filtro/janela visível — o `selected = installments.find(...)` lê da lista completa em `contract-detail.tsx`. Não trocar filtro automaticamente.
- **Ordem:** sempre cronológica (`sequence` asc) em todos os filtros.
- **a11y:** chips num `role="group"` rotulado "Filtrar parcelas", cada um `button` com `aria-pressed`; `aria-live="polite"` (sr-only) anuncia a contagem do filtro ativo. Precisa passar no portão axe da 7c (rota do contrato).
- **YAGNI:** sem páginas numeradas, sem virtualização, sem persistir o filtro entre visitas.
