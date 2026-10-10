import { describe, expect, it } from "vitest";
import { wizardPreview } from "@/features/contract-wizard/lib/wizard-preview";
import {
  emptyValues,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const TODAY = "2026-10-05";
const step1: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
};
const step2: WizardValues = {
  ...step1,
  mode: "split",
  totalCents: 600_000,
  count: 12,
  firstDueDate: "2026-11-10",
};

describe("wizardPreview", () => {
  it("vazio: tudo nulo, para o cartão desenhar os tracejados", () => {
    expect(wizardPreview(emptyValues(), TODAY)).toMatchObject({
      side: null,
      title: null,
      totalCents: null,
      summary: null,
      person: null,
      rows: [],
      count: 0,
    });
  });

  it("depois do passo 1: o lado e o nome; o resto ainda tracejado", () => {
    expect(wizardPreview(step1, TODAY)).toMatchObject({
      side: "receive",
      title: "Notebook da Renata",
      description: "Dell Inspiron 15, usado, com carregador",
      totalCents: null,
      rows: [],
    });
  });

  it("depois do passo 2: o total, as 3 primeiras, a última data e a barra", () => {
    const model = wizardPreview(step2, TODAY);
    expect(model.totalCents).toBe(600_000);
    expect(model.summary).toEqual({
      kind: "even",
      amountCents: 50_000,
      count: 12,
      day: 10,
    });
    expect(model.rows).toEqual([
      {
        sequence: 1,
        dueDate: "2026-11-10",
        amountCents: 50_000,
        adjusted: false,
      },
      {
        sequence: 2,
        dueDate: "2026-12-10",
        amountCents: 50_000,
        adjusted: false,
      },
      {
        sequence: 3,
        dueDate: "2027-01-10",
        amountCents: 50_000,
        adjusted: false,
      },
    ]);
    expect(model.count).toBe(12);
    expect(model.lastDueDate).toBe("2027-10-10");
    expect(model.statuses).toEqual(Array.from({ length: 12 }, () => "open"));
  });

  it("1º vencimento no passado: as de antes de hoje já são atrasadas na barra", () => {
    const model = wizardPreview(
      { ...step2, firstDueDate: "2026-09-05" },
      TODAY
    );
    // 05/09 and 05/10 with today = 05/10: "Todas" (the default) paints the first as paid.
    expect(model.statuses?.slice(0, 3)).toEqual(["paid", "today", "open"]);
    expect(model.overdueCount).toBe(0);
    expect(model.paidCount).toBe(1);
  });

  it("Nenhuma: as vencidas ficam atrasadas na barra e nada conta como paga", () => {
    const model = wizardPreview(
      { ...step2, firstDueDate: "2026-09-05", paid: "none" },
      TODAY
    );
    expect(model.statuses?.slice(0, 3)).toEqual(["overdue", "today", "open"]);
    expect(model.overdueCount).toBe(1);
    expect(model.paidCount).toBe(0);
  });

  it("Algumas: só as marcadas ficam pagas; o cartão lista as 3 que faltam", () => {
    const model = wizardPreview(
      {
        ...step2,
        firstDueDate: "2026-07-05",
        paid: "some",
        paidSequences: [1, 3],
      },
      TODAY
    );
    expect(model.statuses?.slice(0, 4)).toEqual([
      "paid",
      "overdue",
      "paid",
      "today",
    ]);
    expect(model.paidCount).toBe(2);
    expect(model.overdueCount).toBe(1);
    expect(model.rows.map((row) => row.sequence)).toEqual([2, 4, 5]);
  });

  it("uma a uma passando do total: a tag ajustada e a soma como total", () => {
    const installments = [
      160_000,
      ...Array.from({ length: 11 }, () => 50_000),
    ].map((amountCents, index) => ({
      amountCents,
      dueDate: `${index < 2 ? "2026" : "2027"}-${String(((index + 10) % 12) + 1).padStart(2, "0")}-10`,
      edited: index === 0,
    }));
    const model = wizardPreview({ ...step2, installments }, TODAY);
    expect(model.rows[0]?.adjusted).toBe(true);
    expect(model.rows[1]?.adjusted).toBe(false);
    expect(model.totalCents).toBe(710_000);
  });

  it("a outra parte e o 'só eu'", () => {
    expect(
      wizardPreview(
        { ...step2, party: "other", counterpartyName: "Renata Campos" },
        TODAY
      ).person
    ).toEqual({ kind: "other", name: "Renata Campos" });
    expect(wizardPreview({ ...step2, party: "solo" }, TODAY).person).toEqual({
      kind: "solo",
    });
  });

  it("acima de 24 parcelas: a barra é por zonas (statuses nulo)", () => {
    expect(wizardPreview({ ...step2, count: 30 }, TODAY).statuses).toBeNull();
  });

  it("uma data apagada nas 3 primeiras: a prévia mostra a data gerada, nunca vazia", () => {
    const model = wizardPreview(
      {
        ...step2,
        count: 3,
        totalCents: 150_000,
        installments: [
          { amountCents: 50_000, dueDate: "2026-11-10", edited: false },
          { amountCents: 50_000, dueDate: "", edited: true },
          { amountCents: 50_000, dueDate: "2027-01-10", edited: false },
        ],
      },
      TODAY
    );
    expect(model.rows.map((row) => row.dueDate)).toEqual([
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
    ]);
  });
});
