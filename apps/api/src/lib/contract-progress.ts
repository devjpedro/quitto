import {
  type InstallmentStatus,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";

interface InstallmentLike {
  amountCents: number;
  dueDate: string;
  status: InstallmentStatus;
}

export interface ContractProgress {
  overdueCount: number;
  paidCents: number;
  paidCount: number;
  percent: number;
  remainingCents: number;
  totalCents: number;
  totalCount: number;
}

/** Computes contract progress and overdue count relative to `todayISO` (YYYY-MM-DD). */
export function computeProgress(
  items: InstallmentLike[],
  todayISO: string
): ContractProgress {
  let paidCents = 0;
  let totalCents = 0;
  let paidCount = 0;
  let overdueCount = 0;

  for (const item of items) {
    totalCents += item.amountCents;
    const paid = isPaidStatus(item.status);
    if (paid) {
      paidCents += item.amountCents;
      paidCount += 1;
    }
    if (isOverdue(item.dueDate, item.status, todayISO)) {
      overdueCount += 1;
    }
  }

  return {
    paidCents,
    totalCents,
    remainingCents: totalCents - paidCents,
    paidCount,
    totalCount: items.length,
    overdueCount,
    percent: totalCents === 0 ? 0 : Math.round((paidCents / totalCents) * 100),
  };
}
