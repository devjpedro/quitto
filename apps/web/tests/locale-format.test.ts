import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatDate,
  formatMoney,
  formatRelativeDays,
  moneyParts,
} from "@/lib/locale-format";

const NBSP_RE = /[  ]/;

describe("formatMoney", () => {
  it("formats BRL in both locales", () => {
    expect(formatMoney(125_000, "pt-BR")).toBe("R$ 1.250,00");
    expect(formatMoney(125_000, "en-US")).toBe("R$1,250.00");
  });

  it("handles zero and negatives", () => {
    expect(formatMoney(0, "pt-BR")).toBe("R$ 0,00");
    expect(formatMoney(-50_000, "pt-BR")).toBe("-R$ 500,00");
  });

  it("normalizes non-breaking spaces to regular spaces", () => {
    const result = formatMoney(125_000, "pt-BR");
    // Ensure no U+00A0 (non-breaking space) or U+202F (narrow no-break space) remain
    expect(result).not.toMatch(NBSP_RE);
    expect(result).toBe("R$ 1.250,00");
  });
});

describe("moneyParts", () => {
  it("splits pt-BR into currency, integer, decimal and fraction", () => {
    expect(moneyParts(125_050, "pt-BR")).toEqual({
      sign: "",
      currency: "R$",
      integer: "1.250",
      decimal: ",",
      fraction: "50",
    });
  });

  it("uses en-US separators", () => {
    expect(moneyParts(125_050, "en-US")).toMatchObject({
      integer: "1,250",
      decimal: ".",
      fraction: "50",
    });
  });

  it("keeps the sign for negative values", () => {
    expect(moneyParts(-900, "pt-BR")).toMatchObject({
      sign: "-",
      integer: "9",
      fraction: "00",
    });
  });
});

describe("formatDate", () => {
  it("formats short dates without timezone drift", () => {
    expect(formatDate("2026-10-02", "pt-BR", "short")).toBe("02/10/2026");
    expect(formatDate("2026-10-02", "en-US", "short")).toBe("10/02/2026");
  });

  it("formats medium dates with the month name", () => {
    expect(formatDate("2026-10-02", "pt-BR", "medium")).toContain("out");
    expect(formatDate("2026-10-02", "en-US", "medium")).toContain("Oct");
  });
});

describe("relative days", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-10-01", "2026-10-02")).toBe(1);
    expect(daysBetween("2026-10-01", "2026-09-27")).toBe(-4);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("speaks naturally in each locale", () => {
    expect(formatRelativeDays("2026-10-01", "2026-10-01", "pt-BR")).toBe(
      "hoje"
    );
    expect(formatRelativeDays("2026-10-02", "2026-10-01", "pt-BR")).toBe(
      "amanhã"
    );
    expect(formatRelativeDays("2026-09-27", "2026-10-01", "pt-BR")).toBe(
      "há 4 dias"
    );
    expect(formatRelativeDays("2026-10-02", "2026-10-01", "en-US")).toBe(
      "tomorrow"
    );
    expect(formatRelativeDays("2026-09-27", "2026-10-01", "en-US")).toBe(
      "4 days ago"
    );
  });
});
