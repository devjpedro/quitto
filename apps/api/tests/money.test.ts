import { describe, expect, it } from "bun:test";
import { splitAmount } from "@quitto/shared";
import { formatCents } from "../src/lib/money";

const NBSP = /[\u00a0\u202f]/;

describe("splitAmount", () => {
  it("splits evenly when divisible", () => {
    expect(splitAmount(12_000, 3)).toEqual([4000, 4000, 4000]);
  });

  it("distributes the remainder to the first installments", () => {
    // 10_000 / 3 = 3333 r1 -> [3334, 3333, 3333]
    expect(splitAmount(10_000, 3)).toEqual([3334, 3333, 3333]);
  });

  it("always sums back to the total", () => {
    const parts = splitAmount(12_000_000, 60);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(12_000_000);
    expect(parts).toHaveLength(60);
  });

  it("throws for non-positive count", () => {
    expect(() => splitAmount(1000, 0)).toThrow();
  });
});

describe("formatCents", () => {
  it("formats zero", () => {
    expect(formatCents(0, "pt-BR")).toBe("R$ 0,00");
  });
  it("formatCents: R$ 1.234,56 em pt-BR e R$1,234.56 em en-US, sem espaço não separável", () => {
    expect(formatCents(123_456, "pt-BR")).toBe("R$ 1.234,56");
    expect(formatCents(123_456, "en-US")).toBe("R$1,234.56");
    expect(formatCents(123_456, "pt-BR")).not.toMatch(NBSP);
  });
});
