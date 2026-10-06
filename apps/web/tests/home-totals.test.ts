import { describe, expect, it } from "vitest";
import { overdueChips, upcomingTotals } from "@/features/home/lib/home-totals";
import { homeFixture, installmentAction, upcomingItem } from "./home-fixtures";

describe("overdueChips (chip de atraso só com 2+ cartões no mesmo sentido)", () => {
  it("um cartão atrasado por sentido: nenhum chip (o valor já está no cartão)", () => {
    const home = homeFixture({
      actions: [
        installmentAction({ id: "a", kind: "overdue", direction: "pay" }),
        installmentAction({ id: "b", kind: "overdue", direction: "receive" }),
      ],
      overdue: { toPayCents: 180_000, toReceiveCents: 70_000 },
    });
    expect(overdueChips(home)).toEqual({
      toPayCents: null,
      toReceiveCents: null,
    });
  });

  it("dois cartões atrasados a receber: o total do sentido; a pagar continua sem chip", () => {
    const home = homeFixture({
      actions: [
        installmentAction({ id: "a", kind: "overdue", direction: "receive" }),
        installmentAction({
          id: "b",
          kind: "overdue",
          direction: "receive",
          contractId: "c2",
        }),
        installmentAction({ id: "c", kind: "overdue", direction: "pay" }),
      ],
      overdue: { toPayCents: 180_000, toReceiveCents: 118_000 },
    });
    expect(overdueChips(home)).toEqual({
      toPayCents: null,
      toReceiveCents: 118_000,
    });
  });

  it("cartões de outro tipo não contam", () => {
    const home = homeFixture({
      actions: [
        installmentAction({ id: "a", kind: "overdue", direction: "receive" }),
        installmentAction({ id: "b", kind: "review", direction: "receive" }),
      ],
      overdue: { toPayCents: 0, toReceiveCents: 48_000 },
    });
    expect(overdueChips(home).toReceiveCents).toBeNull();
  });
});

describe("upcomingTotals (o título de Próximos 30 dias soma só as linhas)", () => {
  it("soma por sentido", () => {
    const items = [
      upcomingItem({
        installmentId: "a",
        direction: "receive",
        amountCents: 32_000,
      }),
      upcomingItem({
        installmentId: "b",
        direction: "receive",
        amountCents: 108_000,
      }),
      upcomingItem({
        installmentId: "c",
        direction: "pay",
        amountCents: 180_000,
      }),
    ];
    expect(upcomingTotals(items)).toEqual({
      toPayCents: 180_000,
      toReceiveCents: 140_000,
    });
  });

  it("lista vazia: zero e zero", () => {
    expect(upcomingTotals([])).toEqual({ toPayCents: 0, toReceiveCents: 0 });
  });
});
