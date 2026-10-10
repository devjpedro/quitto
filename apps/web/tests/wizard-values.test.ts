import { contractRequestSchema } from "@quitto/shared";
import { describe, expect, it } from "vitest";
import {
  emptyValues,
  isWizardDate,
  pastRows,
  rowsOf,
  scheduleOf,
  toRequest,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const TODAY = "2026-10-05";
const request = (values: WizardValues) => toRequest(values, TODAY);

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
    expect(request(emptyValues())).toBeNull();
  });

  it("só eu acompanho: requiresConfirmation false mesmo com o checkbox marcado antes (decisão 7)", () => {
    expect(
      request({ ...filled, party: null, requiresConfirmation: true })
        ?.requiresConfirmation
    ).toBe(false);
    expect(
      request({ ...filled, party: "solo", requiresConfirmation: true })
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
    const body = request({
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
    const body = request({
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
    const body = request({
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

  it("ajustada passando do total: o total vai como a soma, e o pedido passa no schema", () => {
    const body = request({
      ...filled,
      count: 2,
      installments: [
        { amountCents: 400_000, dueDate: "2026-11-10", edited: true },
        { amountCents: 300_000, dueDate: "2026-12-10", edited: false },
      ],
    });
    expect(body?.schedule).toEqual({
      mode: "split",
      totalAmountCents: 700_000,
      installmentsCount: 2,
      firstDueDate: "2026-11-10",
    });
    expect(contractRequestSchema.safeParse(body).success).toBe(true);
  });

  it("mensal ajustada: vai como divisão da soma, nunca com o valor mensal", () => {
    const body = request({
      ...filled,
      mode: "monthly",
      monthlyCents: 100_000,
      count: 2,
      installments: [
        { amountCents: 100_000, dueDate: "2026-11-10", edited: false },
        { amountCents: 50_000, dueDate: "2026-12-10", edited: true },
      ],
    });
    expect(body?.schedule).toMatchObject({
      mode: "split",
      totalAmountCents: 150_000,
    });
    expect(contractRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe("as parcelas já pagas", () => {
  // 1º vencimento três meses atrás: as de 10/07, 10/08 e 10/09 vencem antes de TODAY.
  const past: WizardValues = { ...filled, firstDueDate: "2026-07-10" };

  it("pastRows: só o que vence antes de hoje (hoje não conta)", () => {
    expect(pastRows(past, TODAY).map((row) => row.sequence)).toEqual([1, 2, 3]);
    expect(pastRows({ ...past, firstDueDate: "2026-10-05" }, TODAY)).toEqual(
      []
    );
    expect(pastRows(filled, TODAY)).toEqual([]);
  });

  it("Todas (o padrão): manda as vencidas em paidInstallments", () => {
    expect(past.paid).toBe("all");
    expect(request(past)?.paidInstallments).toEqual([1, 2, 3]);
  });

  it("Nenhuma: não manda o campo", () => {
    expect(request({ ...past, paid: "none" })).not.toHaveProperty(
      "paidInstallments"
    );
  });

  it("Algumas: só as marcadas que ainda são vencidas", () => {
    expect(
      request({ ...past, paid: "some", paidSequences: [3, 1, 9] })
        ?.paidInstallments
    ).toEqual([1, 3]);
    expect(
      request({ ...past, paid: "some", paidSequences: [] })
    ).not.toHaveProperty("paidInstallments");
  });

  it("sem parcela vencida a resposta é ignorada", () => {
    expect(request({ ...filled, paid: "all" })).not.toHaveProperty(
      "paidInstallments"
    );
  });

  it("o corpo passa no schema do shared", () => {
    const body = request({ ...past, paid: "some", paidSequences: [2] });
    expect(contractRequestSchema.safeParse(body).success).toBe(true);
  });
});
