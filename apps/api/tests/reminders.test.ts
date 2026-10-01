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
  receiverUserId: null,
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
        dedupeKey: "reminder:installment_due_soon:i1:u1",
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
    expect(out[0]?.dedupeKey).toBe("reminder:installment_overdue:i1:u1");
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

  it("dono-vendedor recebe o lembrete 'a receber' junto do pagador", () => {
    const out = computeReminders(
      [base({ dueDate: "2026-07-09", receiverUserId: "owner" })],
      today
    );
    expect(out.map((r) => [r.userId, r.type, r.dedupeKey])).toEqual([
      ["u1", "installment_overdue", "reminder:installment_overdue:i1:u1"],
      [
        "owner",
        "installment_overdue_receivable",
        "reminder:installment_overdue_receivable:i1:owner",
      ],
    ]);
  });

  it("dono-vendedor sem pagador vinculado recebe só o 'a receber'", () => {
    const out = computeReminders(
      [base({ payerUserId: null, receiverUserId: "owner" })],
      today
    );
    expect(out.map((r) => [r.userId, r.type])).toEqual([
      ["owner", "installment_due_soon_receivable"],
    ]);
  });

  it("dono-vendedor que herdou o lado pagador recebe só o 'a receber'", () => {
    const out = computeReminders(
      [base({ payerUserId: "owner", receiverUserId: "owner" })],
      today
    );
    expect(out.map((r) => [r.userId, r.type])).toEqual([
      ["owner", "installment_due_soon_receivable"],
    ]);
  });

  it("exclusões (paga / aguardando confirmação) valem também pro recebedor", () => {
    const out = computeReminders(
      [
        base({ status: INSTALLMENT_STATUS.paid, receiverUserId: "owner" }),
        base({
          installmentId: "i2",
          status: INSTALLMENT_STATUS.awaitingConfirmation,
          receiverUserId: "owner",
        }),
      ],
      today
    );
    expect(out).toEqual([]);
  });
});
