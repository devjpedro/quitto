import { describe, expect, it } from "vitest";
import { monthlyDates } from "@/features/auth/lib/invite-stage";

describe("monthlyDates", () => {
  it("o mesmo dia a cada mês, passando o ano", () => {
    expect(monthlyDates("2026-11-15", 4)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("o dia 31 cai no último dia do mês curto", () => {
    expect(monthlyDates("2027-01-31", 3)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });
});
