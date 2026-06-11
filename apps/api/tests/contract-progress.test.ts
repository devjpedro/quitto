import { describe, expect, it } from "bun:test";
import { computeProgress } from "../src/lib/contract-progress";

const rows = [
  { amountCents: 1000, dueDate: "2026-01-10", status: "paid" as const },
  { amountCents: 1000, dueDate: "2026-02-10", status: "confirmed" as const },
  { amountCents: 1000, dueDate: "2026-03-10", status: "pending" as const },
];

describe("computeProgress", () => {
  it("sums paid/confirmed as paid and computes remaining + percent", () => {
    const p = computeProgress(rows, "2026-02-15");
    expect(p.paidCents).toBe(2000);
    expect(p.totalCents).toBe(3000);
    expect(p.remainingCents).toBe(1000);
    expect(p.paidCount).toBe(2);
    expect(p.totalCount).toBe(3);
    expect(p.percent).toBe(67); // arredondado
  });

  it("flags overdue installments (pending and past due)", () => {
    const p = computeProgress(rows, "2026-03-20");
    expect(p.overdueCount).toBe(1);
  });

  it("does not flag overdue before the due date", () => {
    const p = computeProgress(rows, "2026-03-01");
    expect(p.overdueCount).toBe(0);
  });
});
