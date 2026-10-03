import { afterEach, describe, expect, it, vi } from "vitest";
import { dayOfMonth, monthShort, weekdayName } from "@/lib/date-parts";

/**
 * The machine's timezone must never move the day, and the test pins it so it
 * proves that even on a CI runner in UTC: São Paulo (behind UTC) catches a
 * formatter without `timeZone: "UTC"`, Tokyo (ahead of it) catches the date
 * parsed as local midnight.
 */
const ZONES = ["America/Sao_Paulo", "Asia/Tokyo"];

describe("date parts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dia com dois dígitos, mês curto sem ponto e dia da semana curto", () => {
    expect(dayOfMonth("2026-11-01")).toBe("01");
    expect(dayOfMonth("2026-10-13")).toBe("13");
    expect(monthShort("2026-10-13", "pt-BR")).toBe("out");
    expect(monthShort("2026-10-13", "en-US")).toBe("Oct");
    expect(weekdayName("2026-10-13", "pt-BR")).toBe("ter.");
    expect(weekdayName("2026-10-13", "en-US")).toBe("Tue");
  });

  it.each(ZONES)("nunca muda o dia pelo fuso (%s)", async (zone) => {
    vi.stubEnv("TZ", zone);
    // A fresh module: its formatters are cached from the first call.
    vi.resetModules();
    const parts = await import("@/lib/date-parts");
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    expect(parts.monthShort("2026-11-01", "pt-BR")).toBe("nov");
    expect(parts.weekdayName("2026-11-01", "pt-BR")).toBe("dom.");
    expect(parts.monthShort("2026-10-31", "en-US")).toBe("Oct");
    expect(parts.weekdayName("2026-10-31", "en-US")).toBe("Sat");
  });
});
