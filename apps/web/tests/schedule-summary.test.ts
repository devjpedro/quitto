import { describe, expect, it } from "vitest";
import {
  scheduleSummary,
  summaryFromTerms,
  summaryText,
} from "@/lib/schedule-summary";

const row = (amountCents: number, dueDate: string) => ({
  amountCents,
  dueDate,
});

describe("scheduleSummary", () => {
  it("todas iguais e o mesmo dia", () => {
    expect(
      scheduleSummary([row(50_000, "2026-11-10"), row(50_000, "2026-12-10")])
    ).toEqual({ kind: "even", amountCents: 50_000, count: 2, day: 10 });
  });

  it("a 1ª diferente e o resto igual (uma entrada)", () => {
    expect(
      scheduleSummary([
        row(160_000, "2026-11-10"),
        row(40_000, "2026-12-10"),
        row(40_000, "2027-01-10"),
      ])
    ).toEqual({
      kind: "firstDiffers",
      firstCents: 160_000,
      restCents: 40_000,
      count: 2,
      day: 10,
    });
  });

  it("valores variados: o total; dias diferentes: sem dia", () => {
    expect(
      scheduleSummary([
        row(100_000, "2027-01-31"),
        row(200_000, "2027-02-28"),
        row(300_000, "2027-03-31"),
      ])
    ).toEqual({ kind: "varied", count: 3, totalCents: 600_000 });
    expect(
      scheduleSummary([row(1, "2027-01-31"), row(1, "2027-02-28")])
    ).toMatchObject({ kind: "even", day: null });
  });

  it("sem linhas: null", () => {
    expect(scheduleSummary([])).toBeNull();
  });
});

describe("summaryText", () => {
  it("pt-BR: o pedaço em negrito e a frase com o dia", () => {
    expect(
      summaryText(
        { kind: "even", amountCents: 50_000, count: 12, day: 10 },
        "pt-BR",
        "every"
      )
    ).toEqual({
      strong: "12x de R$ 500,00",
      text: "12x de R$ 500,00 · todo dia 10",
    });
    expect(
      summaryText(
        { kind: "even", amountCents: 50_000, count: 12, day: 10 },
        "pt-BR",
        "short"
      ).text
    ).toBe("12x de R$ 500,00 · dia 10");
  });

  it("a entrada e o total", () => {
    expect(
      summaryText(
        {
          kind: "firstDiffers",
          firstCents: 160_000,
          restCents: 40_000,
          count: 11,
          day: null,
        },
        "pt-BR",
        "every"
      ).text
    ).toBe("1ª de R$ 1.600,00 e 11 de R$ 400,00");
    expect(
      summaryText(
        { kind: "varied", count: 3, totalCents: 600_000 },
        "en-US",
        "every"
      ).text
    ).toBe("3 installments · R$6,000.00 in total");
  });
});

describe("summaryFromTerms", () => {
  it("valor igual: even com o dia; diferente: varied", () => {
    expect(
      summaryFromTerms({
        amountCents: 30_000,
        dayOfMonth: 10,
        installmentsCount: 4,
        totalCents: 120_000,
      })
    ).toEqual({ kind: "even", amountCents: 30_000, count: 4, day: 10 });
    expect(
      summaryFromTerms({
        amountCents: null,
        dayOfMonth: null,
        installmentsCount: 4,
        totalCents: 130_000,
      })
    ).toEqual({ kind: "varied", count: 4, totalCents: 130_000 });
  });
});
