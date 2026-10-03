import { describe, expect, it } from "vitest";
import { momentMilestone, momentView } from "@/features/home/lib/moment";
import { homeFixture } from "./home-fixtures";

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
});

describe("momentView", () => {
  it("o texto do cartão limão, no idioma pedido", () => {
    expect(
      momentView({ id: "all_clear", month: "2026-09", paidCount: 12 }, "pt-BR")
    ).toEqual({
      title: "Tudo em dia em setembro",
      detail: "12 de 12 parcelas quitadas",
    });
    expect(momentView({ id: "closest", ...closest }, "pt-BR")).toEqual({
      title: "Mais perto de quitar",
      detail: "Celular da Ana · 9/10",
    });
    expect(
      momentView({ id: "paid", month: "2026-10", cents: 125_000 }, "en-US")
    ).toEqual({
      title: "Paid in October",
      detail: "R$1,250.00",
    });
    expect(momentView({ id: "guide", done: 2, total: 4 }, "pt-BR")).toEqual({
      title: "Comece por aqui",
      detail: "2 de 4",
    });
  });
});
