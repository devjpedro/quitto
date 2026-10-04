import { describe, expect, it } from "vitest";
import {
  milestoneCells,
  onlyMomentStrip,
  sharePercent,
  stripCells,
} from "@/features/home/lib/milestones";
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
        remainingCount: 1,
        nextDueDate: "2026-10-13",
      },
      monthToDate: {
        month: "2026-10",
        paidCents: 125_000,
        receivedCents: 338_000,
      },
      settled: {
        paidCents: 1_250_000,
        receivedCents: 4_190_000,
        payableTotalCents: 1_250_000,
        receivableTotalCents: 4_190_000,
      },
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
      settled: {
        paidCents: 0,
        receivedCents: 4_190_000,
        payableTotalCents: 0,
        receivableTotalCents: 4_190_000,
      },
    });
    expect(cells).toEqual([
      { id: "settled_received", cents: 4_190_000, totalCents: 4_190_000 },
    ]);
  });

  it("as células do já quitado levam o total da direção", () => {
    const cells = milestoneCells({
      ...homeFixture().milestones,
      settled: {
        paidCents: 1_020_000,
        receivedCents: 554_000,
        payableTotalCents: 2_660_000,
        receivableTotalCents: 1_370_000,
      },
    });
    expect(cells).toEqual([
      { id: "settled_paid", cents: 1_020_000, totalCents: 2_660_000 },
      { id: "settled_received", cents: 554_000, totalCents: 1_370_000 },
    ]);
  });
});

describe("sharePercent", () => {
  it("o pago sobre o total, arredondado e entre 0 e 100", () => {
    expect(sharePercent(554_000, 1_370_000)).toBe(40);
    expect(sharePercent(1_020_000, 2_660_000)).toBe(38);
    expect(sharePercent(0, 1000)).toBe(0);
    expect(sharePercent(1000, 0)).toBe(0);
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
      remainingCount: 1,
      nextDueDate: "2026-10-13",
    },
    monthToDate: {
      month: "2026-10",
      paidCents: 125_000,
      receivedCents: 338_000,
    },
    settled: {
      paidCents: 1_250_000,
      receivedCents: 0,
      payableTotalCents: 1_250_000,
      receivableTotalCents: 0,
    },
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

describe("onlyMomentStrip", () => {
  const closest = {
    contractId: "c3",
    title: "Celular da Ana",
    paidCount: 9,
    totalCount: 10,
    percent: 90,
    remainingCount: 1,
    nextDueDate: "2026-10-13",
  };

  it("só o marco do momento: a faixa é só do celular (no desktop a sidebar o mostra)", () => {
    const milestones = {
      ...homeFixture().milestones,
      closestToPayoff: closest,
    };
    expect(onlyMomentStrip(milestones, "closest")).toBe(true);
  });

  it("com outro marco além do momento, a faixa aparece também no desktop", () => {
    const milestones = {
      ...homeFixture().milestones,
      closestToPayoff: closest,
      settled: {
        paidCents: 1_250_000,
        receivedCents: 0,
        payableTotalCents: 1_250_000,
        receivableTotalCents: 0,
      },
    };
    expect(onlyMomentStrip(milestones, "closest")).toBe(false);
  });

  it("um marco que não é o do momento não é só do celular", () => {
    const milestones = {
      ...homeFixture().milestones,
      closestToPayoff: closest,
    };
    expect(onlyMomentStrip(milestones, "guide")).toBe(false);
  });

  it("sem marco nenhum não há faixa", () => {
    expect(onlyMomentStrip(homeFixture().milestones, null)).toBe(false);
  });
});
