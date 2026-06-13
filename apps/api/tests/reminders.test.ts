import { describe, expect, it } from "bun:test";
import { INSTALLMENT_STATUS } from "@quitto/shared";
import { computeReminders } from "../src/lib/reminders";

const base = (
  over: Partial<Parameters<typeof computeReminders>[0][number]>
) => ({
  installmentId: "i1",
  contractId: "c1",
  dueDate: "2026-07-10",
  payerUserId: "u1",
  status: INSTALLMENT_STATUS.pending,
  ...over,
});

describe("computeReminders (today=2026-07-10)", () => {
  const today = "2026-07-10";

  it("flags due today as due_soon", () => {
    const out = computeReminders([base({ dueDate: "2026-07-10" })], today);
    expect(out).toEqual([
      {
        userId: "u1",
        contractId: "c1",
        installmentId: "i1",
        type: "installment_due_soon",
        dedupeKey: "reminder:installment_due_soon:i1",
      },
    ]);
  });

  it("flags due within the window (3 days) as due_soon", () => {
    const out = computeReminders([base({ dueDate: "2026-07-13" })], today);
    expect(out[0]?.type).toBe("installment_due_soon");
  });

  it("ignores due beyond the window", () => {
    const out = computeReminders([base({ dueDate: "2026-07-14" })], today);
    expect(out).toEqual([]);
  });

  it("flags past due as overdue", () => {
    const out = computeReminders([base({ dueDate: "2026-07-09" })], today);
    expect(out[0]?.type).toBe("installment_overdue");
    expect(out[0]?.dedupeKey).toBe("reminder:installment_overdue:i1");
  });

  it("skips installments without a linked payer", () => {
    const out = computeReminders([base({ payerUserId: null })], today);
    expect(out).toEqual([]);
  });

  it("skips settled (confirmed) installments", () => {
    const out = computeReminders(
      [base({ dueDate: "2026-07-09", status: INSTALLMENT_STATUS.confirmed })],
      today
    );
    expect(out).toEqual([]);
  });

  it("skips settled (paid) installments", () => {
    const out = computeReminders(
      [base({ dueDate: "2026-07-09", status: INSTALLMENT_STATUS.paid })],
      today
    );
    expect(out).toEqual([]);
  });

  it("skips awaiting_confirmation installments", () => {
    const out = computeReminders(
      [
        base({
          dueDate: "2026-07-09",
          status: INSTALLMENT_STATUS.awaitingConfirmation,
        }),
      ],
      today
    );
    expect(out).toEqual([]);
  });

  it("still reminds disputed installments (overdue)", () => {
    // Disputed = payer must re-act, so overdue reminder fires.
    const out = computeReminders(
      [base({ dueDate: "2026-07-09", status: INSTALLMENT_STATUS.disputed })],
      today
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe("installment_overdue");
  });
});
