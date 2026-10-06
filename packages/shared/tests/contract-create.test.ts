import { describe, expect, it } from "bun:test";
import {
  CONTRACT_ERROR_CODES,
  contractRequestSchema,
  isContractErrorCode,
  oppositeRole,
  toScheduleInput,
} from "../src/contract-create";
import { isRealISODate } from "../src/date";

/** n copies of a value (biome wants `new Array`; this reads better). */
function times<T>(count: number, value: T): T[] {
  return Array.from({ length: count }, () => value);
}

const valid = {
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
  ownerRole: "seller" as const,
  requiresConfirmation: true,
  schedule: {
    mode: "split" as const,
    totalAmountCents: 600_000,
    installmentsCount: 12,
    firstDueDate: "2026-11-10",
  },
  counterparty: { name: "Renata Campos", email: "renata.campos@exemplo.com" },
};

/** The codes and paths a body raises, in order. */
function issues(body: unknown) {
  const result = contractRequestSchema.safeParse(body);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => ({
    code: issue.message,
    path: issue.path.join("."),
    params: "params" in issue ? issue.params : undefined,
  }));
}

describe("contractRequestSchema", () => {
  it("aceita o contrato do mockup 15", () => {
    expect(issues(valid)).toEqual([]);
  });

  it("aceita o mensal, sem outra parte", () => {
    expect(
      issues({
        ...valid,
        counterparty: undefined,
        schedule: {
          mode: "monthly",
          monthlyAmountCents: 125_000,
          months: 12,
          firstDueDate: "2026-11-05",
        },
      })
    ).toEqual([]);
  });

  it("o nome é aparado; vazio é contract.title.required", () => {
    expect(issues({ ...valid, title: "   " })).toEqual([
      { code: "contract.title.required", path: "title", params: undefined },
    ]);
    const parsed = contractRequestSchema.parse({ ...valid, title: "  Moto  " });
    expect(parsed.title).toBe("Moto");
  });

  it("nome com mais de 200 caracteres: contract.title.tooLong", () => {
    expect(issues({ ...valid, title: "a".repeat(201) })[0]?.code).toBe(
      "contract.title.tooLong"
    );
  });

  it("sem papel: contract.role.required", () => {
    expect(issues({ ...valid, ownerRole: undefined })[0]?.code).toBe(
      "contract.role.required"
    );
  });

  it("sem modo: schedule.mode.required", () => {
    expect(
      issues({ ...valid, schedule: { firstDueDate: "2026-11-10" } })[0]?.code
    ).toBe("schedule.mode.required");
  });

  it("total zero: schedule.total.min; sem total: schedule.total.required", () => {
    expect(
      issues({
        ...valid,
        schedule: { ...valid.schedule, totalAmountCents: 0 },
      })[0]?.code
    ).toBe("schedule.total.min");
    expect(
      issues({
        ...valid,
        schedule: { ...valid.schedule, totalAmountCents: undefined },
      })[0]?.code
    ).toBe("schedule.total.required");
  });

  it("R$ 0,05 em 12x não se divide: schedule.total.tooSmall com {count}", () => {
    expect(
      issues({ ...valid, schedule: { ...valid.schedule, totalAmountCents: 5 } })
    ).toEqual([
      {
        code: "schedule.total.tooSmall",
        path: "schedule.totalAmountCents",
        params: { count: 12 },
      },
    ]);
  });

  it("0 ou 601 parcelas: schedule.count.range", () => {
    for (const installmentsCount of [0, 601]) {
      expect(
        issues({
          ...valid,
          schedule: { ...valid.schedule, installmentsCount },
        })[0]?.code
      ).toBe("schedule.count.range");
    }
  });

  it("data vazia: schedule.firstDue.required; 31/02: date.invalid", () => {
    expect(
      issues({ ...valid, schedule: { ...valid.schedule, firstDueDate: "" } })[0]
        ?.code
    ).toBe("schedule.firstDue.required");
    expect(
      issues({
        ...valid,
        schedule: { ...valid.schedule, firstDueDate: "2027-02-31" },
      })[0]?.code
    ).toBe("date.invalid");
  });

  it("data no passado não é erro (é aviso, decisão do dono)", () => {
    expect(
      issues({
        ...valid,
        schedule: { ...valid.schedule, firstDueDate: "2026-09-10" },
      })
    ).toEqual([]);
  });

  it("uma a uma passando do total: installments.sum.over com {diff}", () => {
    const installments = [160_000, ...times(11, 50_000)].map(
      (amountCents, index) => ({
        amountCents,
        dueDate: `2027-${String(index + 1).padStart(2, "0")}-10`,
      })
    );
    expect(issues({ ...valid, installments })).toEqual([
      {
        code: "installments.sum.over",
        path: "installments",
        params: { diff: 110_000 },
      },
    ]);
  });

  it("uma a uma faltando: installments.sum.under", () => {
    const installments = Array.from({ length: 12 }, (_, index) => ({
      amountCents: 40_000,
      dueDate: `2027-${String(index + 1).padStart(2, "0")}-10`,
    }));
    expect(issues({ ...valid, installments })[0]?.code).toBe(
      "installments.sum.under"
    );
  });

  it("uma a uma com outro número de parcelas: installments.count.mismatch", () => {
    expect(
      issues({
        ...valid,
        installments: [{ amountCents: 600_000, dueDate: "2026-11-10" }],
      })[0]?.code
    ).toBe("installments.count.mismatch");
  });

  it("parcela de zero: installments.amount.min", () => {
    const installments = Array.from({ length: 12 }, (_, index) => ({
      amountCents: index === 0 ? 0 : 50_000,
      dueDate: "2026-11-10",
    }));
    expect(issues({ ...valid, installments })[0]).toMatchObject({
      code: "installments.amount.min",
      path: "installments.0.amountCents",
    });
  });

  it("outra parte sem nome: counterparty.name.required", () => {
    expect(
      issues({ ...valid, counterparty: { name: " ", email: "" } })[0]?.code
    ).toBe("counterparty.name.required");
  });

  it("e-mail em branco passa; malformado é counterparty.email.invalid", () => {
    expect(
      issues({ ...valid, counterparty: { name: "Renata Campos", email: "" } })
    ).toEqual([]);
    expect(
      issues({
        ...valid,
        counterparty: { name: "Renata Campos", email: "renata@" },
      })[0]?.code
    ).toBe("counterparty.email.invalid");
  });

  it("legado: auto e custom continuam aceitos até a Fase 6", () => {
    expect(
      issues({ ...valid, schedule: { ...valid.schedule, mode: "auto" } })
    ).toEqual([]);
    expect(
      issues({
        ...valid,
        schedule: {
          mode: "custom",
          installments: [{ amountCents: 600_000, dueDate: "2026-11-10" }],
        },
      })
    ).toEqual([]);
  });

  it("toda mensagem do schema é um código conhecido", () => {
    const bodies = [
      {},
      { ...valid, title: "", ownerRole: "x", schedule: { mode: "split" } },
      { ...valid, counterparty: { name: "", email: "x" } },
    ];
    for (const body of bodies) {
      for (const issue of issues(body)) {
        expect(isContractErrorCode(issue.code), issue.code).toBe(true);
      }
    }
  });
});

describe("toScheduleInput", () => {
  it("auto vira split; custom não tem cronograma gerado", () => {
    expect(toScheduleInput({ ...valid.schedule, mode: "auto" })).toMatchObject({
      mode: "split",
      totalAmountCents: 600_000,
    });
    expect(
      toScheduleInput({
        mode: "custom",
        installments: [{ amountCents: 1, dueDate: "2026-11-10" }],
      })
    ).toBeNull();
  });
});

describe("oppositeRole / codes / datas", () => {
  it("o papel da outra parte é o oposto do dono", () => {
    expect(oppositeRole("seller")).toBe("buyer");
    expect(oppositeRole("buyer")).toBe("seller");
  });

  it("os 21 códigos, sem repetição", () => {
    expect(CONTRACT_ERROR_CODES).toHaveLength(21);
    expect(new Set(CONTRACT_ERROR_CODES).size).toBe(21);
  });

  it("isRealISODate recusa 31/02 e 2026-13-01", () => {
    expect(isRealISODate("2027-02-28")).toBe(true);
    expect(isRealISODate("2028-02-29")).toBe(true);
    expect(isRealISODate("2027-02-31")).toBe(false);
    expect(isRealISODate("2026-13-01")).toBe(false);
  });
});
