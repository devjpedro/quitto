import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dayOfMonth,
  monthShort,
  weekdayLong,
  weekdayName,
} from "@/lib/date-parts";
import { importInZone, ZONES } from "./time-zones";

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

  it("dia da semana por extenso, sem o '-feira' (a ajuda do 1º vencimento)", () => {
    expect(weekdayLong("2026-11-10", "pt-BR")).toBe("terça");
    expect(weekdayLong("2026-11-14", "pt-BR")).toBe("sábado");
    expect(weekdayLong("2026-11-15", "pt-BR")).toBe("domingo");
    expect(weekdayLong("2026-11-10", "en-US")).toBe("Tuesday");
  });

  it.each(ZONES)("nunca muda o dia pelo fuso (%s)", async (zone) => {
    const parts = await importInZone(zone, () => import("@/lib/date-parts"));
    expect(parts.monthShort("2026-11-01", "pt-BR")).toBe("nov");
    expect(parts.weekdayName("2026-11-01", "pt-BR")).toBe("dom.");
    expect(parts.monthShort("2026-10-31", "en-US")).toBe("Oct");
    expect(parts.weekdayName("2026-10-31", "en-US")).toBe("Sat");
  });
});
