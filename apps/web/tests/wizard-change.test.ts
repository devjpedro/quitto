import { describe, expect, it } from "vitest";
import {
  applyChange,
  filledField,
} from "@/features/contract-wizard/lib/wizard-change";
import {
  emptyValues,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const adjusted: WizardValues = {
  ...emptyValues(),
  mode: "split",
  totalCents: 600_000,
  count: 2,
  firstDueDate: "2026-11-10",
  installments: [
    { amountCents: 160_000, dueDate: "2026-11-10", edited: true },
    { amountCents: 440_000, dueDate: "2026-12-10", edited: false },
  ],
};

describe("applyChange", () => {
  it.each([
    ["count", 3],
    ["totalCents", 610_000],
    ["firstDueDate", "2026-11-11"],
    ["mode", "monthly"],
  ] as const)(
    "mudar %s descarta a lista ajustada (decisão 24)",
    (key, value) => {
      expect(applyChange(adjusted, key, value).installments).toBeNull();
    }
  );

  it("o mesmo valor não descarta nada; o nome não mexe no cronograma", () => {
    expect(applyChange(adjusted, "count", 2).installments).toHaveLength(2);
    expect(applyChange(adjusted, "title", "Moto").installments).toHaveLength(2);
  });

  it("sem outra parte, sem confirmação (decisão 10 do dono)", () => {
    const withConfirm = {
      ...adjusted,
      party: "other" as const,
      requiresConfirmation: true,
    };
    expect(applyChange(withConfirm, "party", "solo").requiresConfirmation).toBe(
      false
    );
  });
});

describe("filledField", () => {
  it("o que a pessoa já digitou ou escolheu", () => {
    expect(filledField(emptyValues(), "title")).toBe(false);
    expect(filledField({ ...emptyValues(), title: "  " }, "title")).toBe(false);
    expect(filledField({ ...emptyValues(), title: "Moto" }, "title")).toBe(
      true
    );
    expect(filledField(adjusted, "totalCents")).toBe(true);
    expect(filledField(emptyValues(), "firstDueDate")).toBe(false);
  });
});
