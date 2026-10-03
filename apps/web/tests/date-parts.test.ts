import { describe, expect, it } from "vitest";
import { dayOfMonth, monthShort, weekdayName } from "@/lib/date-parts";

describe("date parts", () => {
  it("dia com dois dígitos, mês curto sem ponto e dia da semana curto", () => {
    expect(dayOfMonth("2026-11-01")).toBe("01");
    expect(dayOfMonth("2026-10-13")).toBe("13");
    expect(monthShort("2026-10-13", "pt-BR")).toBe("out");
    expect(monthShort("2026-10-13", "en-US")).toBe("Oct");
    expect(weekdayName("2026-10-13", "pt-BR")).toBe("ter.");
    expect(weekdayName("2026-10-13", "en-US")).toBe("Tue");
  });

  it("nunca muda o dia pelo fuso", () => {
    expect(monthShort("2026-11-01", "pt-BR")).toBe("nov");
    expect(weekdayName("2026-11-01", "pt-BR")).toBe("dom.");
  });
});
