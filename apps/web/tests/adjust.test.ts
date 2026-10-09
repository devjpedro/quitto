import { describe, expect, it } from "vitest";
import { adjustState, editRow } from "@/features/contract-wizard/lib/adjust";
import {
  emptyValues,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const twelve = (first: number, rest: number) =>
  Array.from({ length: 12 }, (_, index) => ({
    amountCents: index === 0 ? first : rest,
    dueDate: `2027-${String(index + 1).padStart(2, "0")}-10`,
    edited: index === 0,
  }));

const base: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  mode: "split",
  totalCents: 600_000,
  count: 12,
  firstDueDate: "2027-01-10",
};

describe("editRow", () => {
  it("muda a linha e a marca como mexida; as outras ficam", () => {
    const rows = editRow(twelve(50_000, 50_000), 3, { amountCents: 70_000 });
    expect(rows[3]).toMatchObject({ amountCents: 70_000, edited: true });
    expect(rows[4]).toMatchObject({ amountCents: 50_000, edited: false });
  });
});

describe("adjustState", () => {
  it("o total vira a soma, e o antigo vem como 'era'", () => {
    const state = adjustState({
      ...base,
      installments: twelve(160_000, 50_000),
    });
    expect(state).toMatchObject({
      sum: 710_000,
      previous: 600_000,
      moved: true,
      freeCount: 11,
    });
    expect(state?.keep?.map((row) => row.amountCents)).toEqual([
      160_000,
      ...Array.from({ length: 11 }, () => 40_000),
    ]);
  });

  it("a soma igual ao total: nada se moveu, sem atalho", () => {
    const state = adjustState({
      ...base,
      installments: twelve(160_000, 40_000),
    });
    expect(state?.moved).toBe(false);
    expect(state?.keep).toBeNull();
  });

  it("mensal: 'manter' tira das outras, o total antigo é mensal × meses", () => {
    const state = adjustState({
      ...base,
      mode: "monthly",
      monthlyCents: 50_000,
      installments: twelve(160_000, 50_000),
    });
    expect(state?.previous).toBe(600_000);
    expect(state?.keep).not.toBeNull();
  });

  it("a soma menor que o total também se move: o 'era' fica acima do novo total e Manter devolve a diferença às livres", () => {
    const state = adjustState({
      ...base,
      installments: twelve(10_000, 50_000),
    });
    expect(state).toMatchObject({
      sum: 560_000,
      previous: 600_000,
      moved: true,
    });
    expect(
      state?.keep?.reduce((acc, row) => acc + (row.amountCents ?? 0), 0)
    ).toBe(600_000);
    expect(state?.keep?.[0]?.amountCents).toBe(10_000);
  });

  it("com todas as linhas mexidas não há de onde tirar: keep é null, mas o total segue a soma", () => {
    const state = adjustState({
      ...base,
      installments: twelve(160_000, 50_000).map((row) => ({
        ...row,
        edited: true,
      })),
    });
    expect(state).toMatchObject({ moved: true, freeCount: 0, sum: 710_000 });
    expect(state?.keep).toBeNull();
  });

  it("sem lista: null", () => {
    expect(adjustState(base)).toBeNull();
  });
});
