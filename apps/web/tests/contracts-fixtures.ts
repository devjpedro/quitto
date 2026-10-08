import type { ContractListItem } from "@/features/contracts/types";

/** A contract the user pays, mid-way and on time (every field the API sends). */
export function listItem(
  overrides: Partial<ContractListItem> = {}
): ContractListItem {
  return {
    id: "c1",
    title: "Empréstimo do Carlos",
    description: null,
    participantNames: ["Maria", "Carlos Lima"],
    ownerRole: "buyer",
    status: "active",
    totalCents: 600_000,
    paidCents: 300_000,
    percent: 50,
    overdueCount: 0,
    installmentsCount: 6,
    nextDueDate: "2026-10-10",
    createdAt: "2026-04-01T12:00:00.000Z",
    direction: "pay",
    counterpartyName: "Carlos Lima",
    paidCount: 3,
    remainingCents: 300_000,
    statuses: ["paid", "paid", "paid", "open", "open", "open"],
    reviewCount: 0,
    disputedCount: 0,
    installmentAmountCents: 100_000,
    monthly: true,
    next: {
      sequence: 4,
      dueDate: "2026-10-10",
      amountCents: 100_000,
      status: "pending",
    },
    oldestOverdue: null,
    endDate: "2026-12-10",
    settled: false,
    ...overrides,
  };
}
