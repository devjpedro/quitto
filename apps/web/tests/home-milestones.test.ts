import { describe, expect, it } from "vitest";
import { milestoneCells, stripCells } from "@/features/home/lib/milestones";
import { homeFixture } from "./home-fixtures";

describe("milestoneCells", () => {
  it("sem nada a mostrar não há célula (nunca um zero na tela)", () => {
    expect(milestoneCells(homeFixture().milestones)).toEqual([]);
  });

  it("na ordem: tudo em dia, mais perto de quitar, recebido, pago e o quitado por direção", () => {
    const cells = milestoneCells({
      previousMonthAllClear: { month: "2026-09", paidCount: 12 },
      closestToPayoff: {
        contractId: "c3",
        title: "Celular da Ana",
        paidCount: 9,
        totalCount: 10,
        percent: 90,
      },
      monthToDate: {
        month: "2026-10",
        paidCents: 125_000,
        receivedCents: 338_000,
      },
      settled: { paidCents: 1_250_000, receivedCents: 4_190_000 },
    });
    expect(cells.map((c) => c.id)).toEqual([
      "all_clear",
      "closest",
      "received",
      "paid",
      "settled_paid",
      "settled_received",
    ]);
  });

  it("quitado só numa direção: uma célula só, nunca a soma", () => {
    const cells = milestoneCells({
      ...homeFixture().milestones,
      settled: { paidCents: 0, receivedCents: 4_190_000 },
    });
    expect(cells).toEqual([{ id: "settled_received", cents: 4_190_000 }]);
  });
});

describe("stripCells", () => {
  const cells = milestoneCells({
    previousMonthAllClear: null,
    closestToPayoff: {
      contractId: "c3",
      title: "Celular da Ana",
      paidCount: 9,
      totalCount: 10,
      percent: 90,
    },
    monthToDate: {
      month: "2026-10",
      paidCents: 125_000,
      receivedCents: 338_000,
    },
    settled: { paidCents: 1_250_000, receivedCents: 0 },
  });

  it("o marco do momento abre a faixa em linha inteira; o resto vai de dois em dois", () => {
    expect(
      stripCells(cells, "closest").map((s) => [s.cell.id, s.moment, s.wide])
    ).toEqual([
      ["closest", true, true],
      ["received", false, false],
      ["paid", false, false],
      ["settled_paid", false, true],
    ]);
  });

  it("sem o marco na faixa (ex.: o progresso do guia), a ordem de sempre", () => {
    expect(
      stripCells(cells, "guide").map((s) => [s.cell.id, s.moment, s.wide])
    ).toEqual([
      ["closest", false, false],
      ["received", false, false],
      ["paid", false, false],
      ["settled_paid", false, false],
    ]);
  });
});
