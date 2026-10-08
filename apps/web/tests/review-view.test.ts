import { describe, expect, it } from "vitest";
import { reviewView } from "@/features/contract-wizard/lib/review-view";
import { wizardPreview } from "@/features/contract-wizard/lib/wizard-preview";
import {
  emptyValues,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const VARIED: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  mode: "split",
  totalCents: 600_000,
  count: 3,
  firstDueDate: "2030-12-10",
  installments: [
    { amountCents: 100_000, dueDate: "2030-12-10", edited: true },
    { amountCents: 200_000, dueDate: "2031-01-10", edited: true },
    { amountCents: 300_000, dueDate: "2031-02-10", edited: true },
  ],
};

describe("reviewView", () => {
  it("valores variados: o total aparece uma vez na linha do cronograma", () => {
    const view = reviewView(
      VARIED,
      wizardPreview(VARIED, "2026-10-05"),
      "pt-BR"
    );
    expect(view.scheduleLine).toBe("3 parcelas · R$ 6.000,00 no total");
  });

  it("quem paga, sem o nome da outra parte: a confirmação com maiúscula", () => {
    const values: WizardValues = {
      ...VARIED,
      ownerRole: "buyer",
      party: "other",
      counterpartyName: "",
      requiresConfirmation: true,
    };
    expect(
      reviewView(values, wizardPreview(values, "2026-10-05"), "pt-BR")
        .confirmLine
    ).toBe("A outra parte confirma cada pagamento");
  });
});
