import { describe, expect, it } from "bun:test";
import { splitAmount } from "../src/lib/money";

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
