import { describe, expect, it } from "bun:test";
import { INSTALLMENT_STATUS, isOverdue, isPaidStatus } from "../src/domain";

describe("domain predicates", () => {
  it("isPaidStatus cobre paid e confirmed", () => {
    expect(isPaidStatus(INSTALLMENT_STATUS.paid)).toBe(true);
    expect(isPaidStatus(INSTALLMENT_STATUS.confirmed)).toBe(true);
    expect(isPaidStatus(INSTALLMENT_STATUS.pending)).toBe(false);
  });

  it("isOverdue: vencida e pendente é atrasada", () => {
    expect(
      isOverdue("2026-01-01", INSTALLMENT_STATUS.pending, "2026-02-01")
    ).toBe(true);
  });

  it("isOverdue: aguardando confirmação não é atrasada", () => {
    expect(
      isOverdue(
        "2026-01-01",
        INSTALLMENT_STATUS.awaitingConfirmation,
        "2026-02-01"
      )
    ).toBe(false);
  });

  it("isOverdue: antes do vencimento não é atrasada", () => {
    expect(
      isOverdue("2026-03-01", INSTALLMENT_STATUS.pending, "2026-02-01")
    ).toBe(false);
  });
});
