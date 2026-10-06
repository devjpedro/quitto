import { describe, expect, it } from "vitest";
import {
  emptyValues,
  isWizardDate,
  rowsOf,
  scheduleOf,
  toRequest,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const filled: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
  mode: "split",
  totalCents: 600_000,
  count: 12,
  firstDueDate: "2026-11-10",
};

describe("scheduleOf / rowsOf", () => {
  it("incompleto: sem cronograma e sem linhas", () => {
    expect(scheduleOf(emptyValues())).toBeNull();
    expect(scheduleOf({ ...filled, firstDueDate: "" })).toBeNull();
    expect(scheduleOf({ ...filled, count: 0 })).toBeNull();
    expect(scheduleOf({ ...filled, count: 601 })).toBeNull();
    // R$ 0,05 em 12x: a conta daria parcelas de zero
    expect(scheduleOf({ ...filled, totalCents: 5 })).toBeNull();
    expect(rowsOf(emptyValues())).toEqual([]);
  });

  it("split completo: 12 linhas do buildSchedule", () => {
    expect(scheduleOf(filled)).toEqual({
      mode: "split",
      totalAmountCents: 600_000,
      installmentsCount: 12,
      firstDueDate: "2026-11-10",
    });
    expect(rowsOf(filled)).toHaveLength(12);
  });

  it("mensal: o valor do mês e os meses", () => {
    expect(
      scheduleOf({
        ...filled,
        mode: "monthly",
        monthlyCents: 125_000,
        count: 12,
      })
    ).toEqual({
      mode: "monthly",
      monthlyAmountCents: 125_000,
      months: 12,
      firstDueDate: "2026-11-10",
    });
  });

  it("com a lista ajustada, as linhas são as dela (um valor vazio conta como zero)", () => {
    const rows = rowsOf({
      ...filled,
      count: 2,
      installments: [
        { amountCents: 160_000, dueDate: "2026-11-10", edited: true },
        { amountCents: null, dueDate: "2026-12-10", edited: false },
      ],
    });
    expect(rows.map((row) => row.amountCents)).toEqual([160_000, 0]);
  });

  it("uma data apagada na lista: a linha fica com a data gerada", () => {
    const rows = rowsOf({
      ...filled,
      count: 2,
      installments: [
        { amountCents: 300_000, dueDate: "2026-11-10", edited: false },
        { amountCents: 300_000, dueDate: "", edited: true },
      ],
    });
    expect(rows.map((row) => row.dueDate)).toEqual([
      "2026-11-10",
      "2026-12-10",
    ]);
  });

  it("isWizardDate: o formato e um dia que existe", () => {
    expect(isWizardDate("2026-11-10")).toBe(true);
    expect(isWizardDate("")).toBe(false);
    expect(isWizardDate("2026-02-30")).toBe(false);
  });
});

describe("toRequest", () => {
  it("sem papel: null (o passo 1 não passou)", () => {
    expect(toRequest(emptyValues())).toBeNull();
  });

  it("só eu acompanho: requiresConfirmation false mesmo com o checkbox marcado antes (decisão 7)", () => {
    expect(
      toRequest({ ...filled, party: null, requiresConfirmation: true })
        ?.requiresConfirmation
    ).toBe(false);
    expect(
      toRequest({ ...filled, party: "solo", requiresConfirmation: true })
    ).toEqual({
      title: "Notebook da Renata",
      description: "Dell Inspiron 15, usado, com carregador",
      ownerRole: "seller",
      requiresConfirmation: false,
      schedule: {
        mode: "split",
        totalAmountCents: 600_000,
        installmentsCount: 12,
        firstDueDate: "2026-11-10",
      },
    });
  });

  it("com a outra parte: o nome, o e-mail aparado e a confirmação", () => {
    const body = toRequest({
      ...filled,
      party: "other",
      counterpartyName: "Renata Campos",
      counterpartyEmail: " renata.campos@exemplo.com ",
      requiresConfirmation: true,
    });
    expect(body?.counterparty).toEqual({
      name: "Renata Campos",
      email: "renata.campos@exemplo.com",
    });
    expect(body?.requiresConfirmation).toBe(true);
  });

  it("outra parte sem e-mail: sem a chave email; descrição vazia some", () => {
    const body = toRequest({
      ...filled,
      description: "  ",
      party: "other",
      counterpartyName: "Renata Campos",
      counterpartyEmail: "",
    });
    expect(body?.counterparty).toEqual({ name: "Renata Campos" });
    expect(body && "description" in body).toBe(false);
  });

  it("a lista ajustada vai em installments", () => {
    const body = toRequest({
      ...filled,
      count: 1,
      totalCents: 600_000,
      installments: [
        { amountCents: 600_000, dueDate: "2026-11-10", edited: true },
      ],
    });
    expect(body?.installments).toEqual([
      { amountCents: 600_000, dueDate: "2026-11-10" },
    ]);
  });
});
