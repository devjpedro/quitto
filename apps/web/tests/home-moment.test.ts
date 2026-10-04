import { describe, expect, it } from "vitest";
import { momentMilestone, momentView } from "@/features/home/lib/moment";
import { homeFixture, TODAY } from "./home-fixtures";

/** A no-break space (U+00A0), by code: "desde" and the date never part at a line end. */
const NBSP = String.fromCharCode(0xa0);

const base = homeFixture();
const closest = {
  contractId: "c3",
  title: "Celular da Ana",
  paidCount: 9,
  totalCount: 10,
  percent: 90,
  remainingCount: 1,
  nextDueDate: "2026-10-13",
};

describe("momentMilestone", () => {
  it("tudo em dia no mês passado vem antes de qualquer outro marco", () => {
    const home = homeFixture({
      milestones: {
        ...base.milestones,
        previousMonthAllClear: { month: "2026-09", paidCount: 12 },
        closestToPayoff: closest,
        monthToDate: { month: "2026-10", paidCents: 125_000, receivedCents: 0 },
      },
    });
    expect(momentMilestone(home)).toEqual({
      id: "all_clear",
      month: "2026-09",
      paidCount: 12,
    });
  });

  it("depois o mais perto de quitar; depois o pago e o recebido no mês", () => {
    const withClosest = homeFixture({
      milestones: { ...base.milestones, closestToPayoff: closest },
    });
    expect(momentMilestone(withClosest)?.id).toBe("closest");
    const month = (paidCents: number, receivedCents: number) =>
      homeFixture({
        milestones: {
          ...base.milestones,
          monthToDate: { month: "2026-10", paidCents, receivedCents },
        },
      });
    expect(momentMilestone(month(125_000, 338_000))).toEqual({
      id: "paid",
      month: "2026-10",
      cents: 125_000,
    });
    expect(momentMilestone(month(0, 338_000))).toEqual({
      id: "received",
      month: "2026-10",
      cents: 338_000,
    });
  });

  it("sem marco, o progresso do guia; sem guia, nada (o cartão some)", () => {
    const guide = homeFixture({
      onboarding: { ...base.onboarding, hasPixKey: false, remindersOn: false },
    });
    expect(momentMilestone(guide)).toEqual({ id: "guide", done: 2, total: 4 });
    expect(momentMilestone(base)).toBeNull();
  });

  it("o marco do guia segue a regra de sumir: acompanhar contratos não conta; 30 dias de conta, sim", () => {
    const pending = {
      ...base.onboarding,
      hasContract: false,
      hasPixKey: false,
      remindersOn: false,
    };
    const following = homeFixture({
      activeContractsCount: 5,
      onboarding: { ...pending, activePartyContracts: 0 },
    });
    expect(momentMilestone(following)).toEqual({
      id: "guide",
      done: 1,
      total: 4,
    });
    const outgrown = homeFixture({
      onboarding: { ...pending, accountCreatedOn: "2026-09-02" },
    });
    expect(momentMilestone(outgrown)).toBeNull();
  });
});

describe("momentView", () => {
  it("rótulo, título, detalhe e o % do anel, no idioma pedido", () => {
    expect(
      momentView(
        { id: "all_clear", month: "2026-09", paidCount: 12 },
        "pt-BR",
        TODAY
      )
    ).toEqual({
      label: "Tudo em dia em setembro",
      title: "12 de 12 parcelas quitadas",
      detail: null,
      percent: 100,
    });
    expect(momentView({ id: "closest", ...closest }, "pt-BR", TODAY)).toEqual({
      label: "Mais perto de quitar",
      title: "Celular da Ana · 9/10",
      detail: "Falta 1 parcela, em 13/10",
      percent: 90,
    });
    expect(
      momentView(
        {
          id: "closest",
          ...closest,
          paidCount: 6,
          remainingCount: 4,
          percent: 60,
        },
        "pt-BR",
        TODAY
      ).detail
    ).toBe("Faltam 4 parcelas");
    // One left with no date (the last one has no due date yet): singular, never "Faltam 1 parcelas".
    expect(
      momentView(
        { id: "closest", ...closest, nextDueDate: null },
        "pt-BR",
        TODAY
      ).detail
    ).toBe("Falta 1 parcela");
    expect(
      momentView(
        { id: "paid", month: "2026-10", cents: 125_000 },
        "en-US",
        TODAY
      )
    ).toEqual({
      label: "Paid in October",
      title: "R$1,250.00",
      detail: null,
      percent: null,
    });
    expect(
      momentView({ id: "guide", done: 2, total: 4 }, "pt-BR", TODAY)
    ).toEqual({
      label: "Comece por aqui",
      title: "2 de 4",
      detail: null,
      percent: 50,
    });
  });

  it("a parcela que falta já venceu: 'em atraso desde', nunca 'em' uma data passada", () => {
    const late = {
      id: "closest" as const,
      ...closest,
      nextDueDate: "2026-09-13",
    };
    expect(momentView(late, "pt-BR", TODAY).detail).toBe(
      `Falta 1 parcela · em atraso desde${NBSP}13/09`
    );
    expect(momentView(late, "en-US", TODAY).detail).toBe(
      `1 installment left · overdue since${NBSP}09/13`
    );
    // More than one left, the oldest late: the delay is said too.
    expect(
      momentView(
        { ...late, paidCount: 6, remainingCount: 4, percent: 60 },
        "pt-BR",
        TODAY
      ).detail
    ).toBe(`Faltam 4 parcelas · em atraso desde${NBSP}13/09`);
    // Another year: the year is written, as on the cards.
    expect(
      momentView({ ...late, nextDueDate: "2025-12-10" }, "pt-BR", TODAY).detail
    ).toBe(`Falta 1 parcela · em atraso desde${NBSP}10/12/2025`);
    // Due today is not late yet.
    expect(
      momentView({ ...late, nextDueDate: TODAY }, "pt-BR", TODAY).detail
    ).toBe("Falta 1 parcela, em 02/10");
  });

  it("'desde' e a data nunca se separam no fim da linha (espaço sem quebra), nos dois idiomas", () => {
    const late = {
      id: "closest" as const,
      ...closest,
      nextDueDate: "2026-09-13",
    };
    for (const locale of ["pt-BR", "en-US"] as const) {
      for (const remainingCount of [1, 4]) {
        const detail = momentView({ ...late, remainingCount }, locale, TODAY)
          .detail as string;
        const date = locale === "pt-BR" ? "13/09" : "09/13";
        expect(detail.endsWith(`${NBSP}${date}`), detail).toBe(true);
        // The only no-break space is the one before the date.
        expect(detail.split(NBSP)).toHaveLength(2);
      }
    }
  });
});
