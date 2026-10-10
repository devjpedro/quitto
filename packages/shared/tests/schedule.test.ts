import { describe, expect, it } from "bun:test";
import {
  addMonths,
  buildSchedule,
  type ScheduleInput,
  scheduleCount,
  scheduleTotal,
  spreadDifference,
  sumMismatch,
} from "../src/schedule";

/** n copies of a value (biome wants `new Array`; this reads better). */
function times<T>(count: number, value: T): T[] {
  return Array.from({ length: count }, () => value);
}

const split = (
  totalAmountCents: number,
  installmentsCount: number,
  firstDueDate = "2026-11-10"
): ScheduleInput => ({
  mode: "split",
  totalAmountCents,
  installmentsCount,
  firstDueDate,
});

const monthly: ScheduleInput = {
  mode: "monthly",
  monthlyAmountCents: 125_000,
  months: 12,
  firstDueDate: "2026-11-05",
};

describe("scheduleTotal / scheduleCount", () => {
  it("split: o total e a quantidade como vieram", () => {
    expect(scheduleTotal(split(600_000, 12))).toBe(600_000);
    expect(scheduleCount(split(600_000, 12))).toBe(12);
  });

  it("mensal: o valor do mês vezes os meses", () => {
    expect(scheduleTotal(monthly)).toBe(1_500_000);
    expect(scheduleCount(monthly)).toBe(12);
  });
});

describe("buildSchedule", () => {
  it("R$ 6.000,00 em 12x: 12 de R$ 500,00, todo dia 10", () => {
    const rows = buildSchedule(split(600_000, 12));
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.amountCents === 50_000)).toBe(true);
    expect(rows[0]).toEqual({
      sequence: 1,
      amountCents: 50_000,
      dueDate: "2026-11-10",
    });
    expect(rows[11]?.dueDate).toBe("2027-10-10");
  });

  it("R$ 1.000,00 em 3x: os centavos que sobram vão para as primeiras", () => {
    expect(
      buildSchedule(split(100_000, 3)).map((row) => row.amountCents)
    ).toEqual([33_334, 33_333, 33_333]);
  });

  it("1º vencimento em 31/01: 28/02, 31/03, 30/04", () => {
    expect(
      buildSchedule(split(400_000, 4, "2027-01-31")).map((row) => row.dueDate)
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("mensal: o valor exato em cada mês", () => {
    const rows = buildSchedule(monthly);
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.amountCents === 125_000)).toBe(true);
  });

  it("parcelas ajustadas viram o cronograma, na ordem, numeradas de 1", () => {
    const rows = buildSchedule(split(600_000, 2), [
      { amountCents: 160_000, dueDate: "2026-11-10" },
      { amountCents: 440_000, dueDate: "2026-12-10" },
    ]);
    expect(rows).toEqual([
      { sequence: 1, amountCents: 160_000, dueDate: "2026-11-10" },
      { sequence: 2, amountCents: 440_000, dueDate: "2026-12-10" },
    ]);
  });

  it("uma lista vazia é o mesmo que nenhuma lista", () => {
    expect(buildSchedule(split(600_000, 12), [])).toHaveLength(12);
  });
});

describe("sumMismatch", () => {
  const rows = (amounts: number[]) =>
    amounts.map((amountCents) => ({ amountCents }));

  it("soma igual ao total: null", () => {
    expect(sumMismatch(split(600_000, 2), rows([300_000, 300_000]))).toBeNull();
  });

  it("1.600 + 11 × 500 = 7.100: R$ 1.100,00 a mais", () => {
    expect(
      sumMismatch(split(600_000, 12), rows([160_000, ...times(11, 50_000)]))
    ).toEqual({ diff: 110_000, direction: "over" });
  });

  it("faltando: a diferença é positiva e a direção é under", () => {
    expect(sumMismatch(split(600_000, 2), rows([100_000, 300_000]))).toEqual({
      diff: 200_000,
      direction: "under",
    });
  });

  it("mensal: compara com valor × meses", () => {
    expect(sumMismatch(monthly, rows(times(12, 125_000)))).toBeNull();
  });
});

describe("spreadDifference", () => {
  it("tirar R$ 1.100,00 das outras 11: 1.600 + 11 × 400 (o quadro D5)", () => {
    const amounts = [160_000, ...times(11, 50_000)];
    const edited = [true, ...times(11, false)];
    expect(
      spreadDifference(amounts, edited, { diff: 110_000, direction: "over" })
    ).toEqual([160_000, ...times(11, 40_000)]);
  });

  it("pôr a falta nas outras, com os centavos que sobram nas primeiras livres", () => {
    expect(
      spreadDifference([100_000, 100_000, 100_000], [true, false, false], {
        diff: 1,
        direction: "under",
      })
    ).toEqual([100_000, 100_001, 100_000]);
  });

  it("nenhuma parcela livre: null", () => {
    expect(
      spreadDifference([100, 100], [true, true], {
        diff: 10,
        direction: "over",
      })
    ).toBeNull();
  });

  it("uma livre ficaria abaixo de R$ 0,01: null", () => {
    expect(
      spreadDifference([500, 100], [true, false], {
        diff: 100,
        direction: "over",
      })
    ).toBeNull();
  });
});

describe("addMonths", () => {
  it("o ano sai sempre com 4 dígitos", () => {
    expect(addMonths("0999-12-10", 1)).toBe("1000-01-10");
    expect(addMonths("0202-11-10", 1)).toBe("0202-12-10");
  });
});
