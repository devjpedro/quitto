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
  it("D7: R$ 1.100,00 a mais, as duas correções", () => {
    const state = adjustState({
      ...base,
      installments: twelve(160_000, 50_000),
    });
    expect(state?.sum).toBe(710_000);
    expect(state?.mismatch).toEqual({ diff: 110_000, direction: "over" });
    expect(state?.freeCount).toBe(11);
    expect(state?.take?.map((row) => row.amountCents)).toEqual([
      160_000,
      ...Array.from({ length: 11 }, () => 40_000),
    ]);
    expect(state?.useTotal?.totalCents).toBe(710_000);
    expect(state?.useTotal?.installments).toHaveLength(12);
  });

  it("D5: confere, sem correção", () => {
    const state = adjustState({
      ...base,
      installments: twelve(160_000, 40_000),
    });
    expect(state?.mismatch).toBeNull();
    expect(state?.take).toBeNull();
    expect(state?.useTotal).toBeNull();
  });

  it("mensal: só tirar das outras, nunca trocar o total (decisão 25)", () => {
    const state = adjustState({
      ...base,
      mode: "monthly",
      monthlyCents: 50_000,
      installments: twelve(160_000, 50_000),
    });
    expect(state?.take).not.toBeNull();
    expect(state?.useTotal).toBeNull();
  });

  it("sem lista: null", () => {
    expect(adjustState(base)).toBeNull();
  });
});
