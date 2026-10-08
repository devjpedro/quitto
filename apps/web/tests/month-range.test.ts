import { describe, expect, it } from "vitest";
import {
  monthBounds,
  monthQuery,
  monthTitle,
  shiftMonth,
} from "@/features/installments/lib/month-range";

describe("month-range", () => {
  it("shiftMonth vira o ano para os dois lados", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
    expect(shiftMonth("2026-10", -10)).toBe("2025-12");
  });

  it("monthBounds de fevereiro bissexto", () => {
    expect(monthBounds("2028-02")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(monthBounds("2027-02").to).toBe("2027-02-28");
    expect(monthBounds("2026-10").to).toBe("2026-10-31");
  });

  it("pastDue só no mês corrente", () => {
    expect(monthQuery("2026-10", "2026-10-08").pastDue).toBe(true);
    expect(monthQuery("2026-11", "2026-10-08").pastDue).toBe(false);
    expect(monthQuery("2026-09", "2026-10-08").pastDue).toBe(false);
  });

  it("no mês corrente, em 29/10, to vai a 04/11; em 10/10, to é 31/10", () => {
    expect(monthQuery("2026-10", "2026-10-29")).toEqual({
      from: "2026-10-01",
      to: "2026-11-04",
      pastDue: true,
    });
    expect(monthQuery("2026-10", "2026-10-10").to).toBe("2026-10-31");
    expect(monthQuery("2026-11", "2026-10-29").to).toBe("2026-11-30");
  });

  it("monthTitle: Outubro de 2026 e October 2026", () => {
    expect(monthTitle("2026-10", "pt-BR")).toBe("Outubro de 2026");
    expect(monthTitle("2026-10", "en-US")).toBe("October 2026");
  });
});
