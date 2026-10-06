import { describe, expect, it } from "vitest";
import {
  fieldOfPath,
  firstField,
  stepOfField,
} from "@/features/contract-wizard/lib/wizard-fields";
import {
  scheduleWarnings,
  validateAdjusted,
  validateStep,
} from "@/features/contract-wizard/lib/wizard-validation";
import {
  emptyValues,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

const ctx = { sessionEmail: "joao.souza@exemplo.com" };
const step2: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  mode: "split",
  totalCents: 600_000,
  count: 12,
  firstDueDate: "2026-11-10",
};
const codes = (values: WizardValues, step: 1 | 2 | 3 | 4) =>
  validateStep(step, values, ctx).map((issue) => [issue.field, issue.code]);

describe("validateStep 1", () => {
  it("sem papel e sem nome: os dois, na ordem da tela", () => {
    expect(codes(emptyValues(), 1)).toEqual([
      ["ownerRole", "contract.role.required"],
      ["title", "contract.title.required"],
    ]);
  });

  it("nome longo demais e descrição longa demais", () => {
    expect(
      codes(
        { ...step2, title: "a".repeat(201), description: "b".repeat(2001) },
        1
      )
    ).toEqual([
      ["title", "contract.title.tooLong"],
      ["description", "contract.description.tooLong"],
    ]);
  });
});

describe("validateStep 2", () => {
  it("sem modo: só o modo", () => {
    expect(codes({ ...step2, mode: null }, 2)).toEqual([
      ["mode", "schedule.mode.required"],
    ]);
  });

  it("total vazio, zero parcelas e data vazia: um código por campo", () => {
    expect(
      codes({ ...step2, totalCents: null, count: 0, firstDueDate: "" }, 2)
    ).toEqual([
      ["totalCents", "schedule.total.required"],
      ["count", "schedule.count.range"],
      ["firstDueDate", "schedule.firstDue.required"],
    ]);
  });

  it("total zero: schedule.total.min; mensal sem valor: schedule.monthly.required", () => {
    expect(codes({ ...step2, totalCents: 0 }, 2)).toEqual([
      ["totalCents", "schedule.total.min"],
    ]);
    expect(codes({ ...step2, mode: "monthly", monthlyCents: null }, 2)).toEqual(
      [["monthlyCents", "schedule.monthly.required"]]
    );
  });

  it("R$ 0,05 em 12x: schedule.total.tooSmall com a contagem", () => {
    expect(validateStep(2, { ...step2, totalCents: 5 }, ctx)).toEqual([
      {
        field: "totalCents",
        code: "schedule.total.tooSmall",
        params: { count: 12 },
      },
    ]);
  });

  it("data no passado passa (é aviso)", () => {
    expect(codes({ ...step2, firstDueDate: "2026-09-10" }, 2)).toEqual([]);
  });
});

describe("validateAdjusted", () => {
  const adjusted = (amounts: (number | null)[]): WizardValues => ({
    ...step2,
    count: amounts.length,
    totalCents: 600_000,
    installments: amounts.map((amountCents, index) => ({
      amountCents,
      dueDate: `2027-0${index + 1}-10`,
      edited: index === 0,
    })),
  });

  it("um valor vazio: o erro na linha", () => {
    expect(validateAdjusted(adjusted([600_000, null]))).toEqual([
      { field: "installments.1.amountCents", code: "installments.amount.min" },
    ]);
  });

  it("a soma passa: installments.sum.over com a diferença", () => {
    expect(validateAdjusted(adjusted([400_000, 300_000]))).toEqual([
      {
        field: "installments",
        code: "installments.sum.over",
        params: { diff: 100_000 },
      },
    ]);
  });

  it("a soma falta: installments.sum.under, e o passo 2 não avança", () => {
    const values = adjusted([400_000, 100_000]);
    expect(validateAdjusted(values)[0]?.code).toBe("installments.sum.under");
    expect(codes(values, 2)).toEqual([
      ["installments", "installments.sum.under"],
    ]);
  });

  it("uma data apagada na lista: date.invalid na linha, e o passo 2 não avança", () => {
    const values = adjusted([300_000, 300_000]);
    const cleared: WizardValues = {
      ...values,
      installments: (values.installments ?? []).map((row, index) =>
        index === 1 ? { ...row, dueDate: "" } : row
      ),
    };
    expect(validateAdjusted(cleared)).toEqual([
      { field: "installments.1.dueDate", code: "date.invalid" },
    ]);
    expect(codes(cleared, 2)).toEqual([
      ["installments.1.dueDate", "date.invalid"],
    ]);
  });
});

describe("validateStep 3 e 4", () => {
  const other: WizardValues = {
    ...step2,
    party: "other",
    counterpartyName: "Renata Campos",
    counterpartyEmail: "renata.campos@exemplo.com",
  };

  it("só eu (ou nenhuma escolha): nada a conferir", () => {
    expect(codes({ ...step2, party: "solo" }, 3)).toEqual([]);
    expect(codes({ ...step2, party: null }, 3)).toEqual([]);
  });

  it("outra parte sem nome e com e-mail malformado", () => {
    expect(
      codes(
        { ...other, counterpartyName: " ", counterpartyEmail: "renata@" },
        3
      )
    ).toEqual([
      ["counterpartyName", "counterparty.name.required"],
      ["counterpartyEmail", "counterparty.email.invalid"],
    ]);
  });

  it("o e-mail da sessão, com outra caixa: counterparty.email.self", () => {
    expect(
      codes({ ...other, counterpartyEmail: "Joao.Souza@exemplo.com" }, 3)
    ).toEqual([["counterpartyEmail", "counterparty.email.self"]]);
  });

  it("passo 4: tudo de novo, na ordem dos passos", () => {
    expect(codes({ ...other, title: "", mode: null }, 4)).toEqual([
      ["title", "contract.title.required"],
      ["mode", "schedule.mode.required"],
    ]);
  });
});

describe("scheduleWarnings", () => {
  it("1º vencimento antes de hoje: aviso no campo", () => {
    expect(
      scheduleWarnings({ ...step2, firstDueDate: "2026-09-10" }, "2026-10-05")
    ).toEqual([{ field: "firstDueDate", code: "schedule.firstDue.past" }]);
    expect(scheduleWarnings(step2, "2026-10-05")).toEqual([]);
  });

  it("uma parcela que vence antes da anterior: aviso na linha", () => {
    expect(
      scheduleWarnings(
        {
          ...step2,
          count: 2,
          installments: [
            { amountCents: 300_000, dueDate: "2026-12-10", edited: true },
            { amountCents: 300_000, dueDate: "2026-11-10", edited: true },
          ],
        },
        "2026-10-05"
      )
    ).toEqual([
      { field: "installments.1.dueDate", code: "installments.date.order" },
    ]);
  });
});

describe("stepOfField / fieldOfPath / firstField", () => {
  it("cada campo no seu passo", () => {
    expect(stepOfField("title")).toBe(1);
    expect(stepOfField("installments.3.amountCents")).toBe(2);
    expect(stepOfField("counterpartyEmail")).toBe(3);
  });

  it("o caminho da API vira o campo da tela", () => {
    expect(fieldOfPath("schedule.totalAmountCents")).toBe("totalCents");
    // zod 4 puts a missing mode on schedule.mode.
    expect(fieldOfPath("schedule.mode")).toBe("mode");
    expect(fieldOfPath("schedule")).toBe("mode");
    expect(fieldOfPath("schedule.months")).toBe("count");
    expect(fieldOfPath("installments")).toBe("installments");
    expect(fieldOfPath("installments.2.amountCents")).toBe(
      "installments.2.amountCents"
    );
    expect(fieldOfPath("counterparty.email")).toBe("counterpartyEmail");
    expect(fieldOfPath("nada")).toBeNull();
    expect(fieldOfPath(undefined)).toBeNull();
  });

  it("o primeiro campo com erro, ou nenhum", () => {
    expect(firstField([])).toBeNull();
    expect(
      firstField([
        { field: "title", code: "contract.title.required" },
        { field: "ownerRole", code: "contract.role.required" },
      ])
    ).toBe("title");
  });
});
