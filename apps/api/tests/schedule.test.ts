import { describe, expect, it } from "bun:test";
import { generateMonthlySchedule, generateSchedule } from "@quitto/shared";

describe("generateSchedule", () => {
  it("creates N installments with monthly due dates and split amounts", () => {
    const rows = generateSchedule({
      totalAmountCents: 12_000_000,
      installmentsCount: 60,
      firstDueDate: "2026-07-10",
    });
    expect(rows).toHaveLength(60);
    expect(rows[0]).toEqual({
      sequence: 1,
      amountCents: 200_000,
      dueDate: "2026-07-10",
    });
    expect(rows[1]?.dueDate).toBe("2026-08-10");
    expect(rows.reduce((a, r) => a + r.amountCents, 0)).toBe(12_000_000);
  });

  it("sequences start at 1 and increase by 1", () => {
    const rows = generateSchedule({
      totalAmountCents: 1000,
      installmentsCount: 2,
      firstDueDate: "2026-01-31",
    });
    expect(rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(rows[1]?.dueDate).toBe("2026-02-28");
  });
});

describe("generateMonthlySchedule", () => {
  it("creates N equal installments of exactly the monthly amount", () => {
    const rows = generateMonthlySchedule({
      monthlyAmountCents: 80_000,
      months: 12,
      firstDueDate: "2026-07-10",
    });
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.amountCents === 80_000)).toBe(true);
    expect(rows.map((r) => r.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(rows[0]?.dueDate).toBe("2026-07-10");
    expect(rows[1]?.dueDate).toBe("2026-08-10");
    expect(rows.reduce((a, r) => a + r.amountCents, 0)).toBe(960_000);
  });

  it("clamps the due day on short months", () => {
    const rows = generateMonthlySchedule({
      monthlyAmountCents: 100_000,
      months: 2,
      firstDueDate: "2026-01-31",
    });
    expect(rows[1]?.dueDate).toBe("2026-02-28");
  });
});
