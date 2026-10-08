import type { InstallmentListItem } from "@/features/installments/types";

let counter = 0;

/** An installment of the list (every field the API sends); a pay-side one, due on the 15th. */
export function listInstallment(
  overrides: Partial<InstallmentListItem> = {}
): InstallmentListItem {
  counter += 1;
  return {
    installmentId: `i${counter}`,
    contractId: "c1",
    contractTitle: "Empréstimo do Carlos",
    sequence: 1,
    installmentsCount: 10,
    amountCents: 50_000,
    dueDate: "2026-10-15",
    status: "pending",
    direction: "pay",
    counterpartyName: "Carlos Lima",
    paidAt: null,
    ...overrides,
  };
}
