import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";

describe("parseMoneyInput", () => {
  it.each([
    ["6.000,00", 600_000],
    ["6000", 600_000],
    ["6.000", 600_000],
    ["1.600,5", 160_050],
    ["6,000.50", 600_050],
    ["6000.5", 600_050],
    ["0,05", 5],
    ["R$ 1.250,00", 125_000],
    ["500", 50_000],
  ] as const)("%s → %i", (text, cents) => {
    expect(parseMoneyInput(text)).toBe(cents);
  });

  it("nada de número: null", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("R$")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });
});

describe("formatMoneyInput", () => {
  it("o valor sem o R$, no jeito de cada idioma", () => {
    expect(formatMoneyInput(600_000, "pt-BR")).toBe("6.000,00");
    expect(formatMoneyInput(600_000, "en-US")).toBe("6,000.00");
    expect(formatMoneyInput(5, "pt-BR")).toBe("0,05");
  });
});
