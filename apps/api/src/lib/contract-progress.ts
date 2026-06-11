interface InstallmentLike {
  amountCents: number;
  dueDate: string;
  status:
    | "pending"
    | "awaiting_confirmation"
    | "confirmed"
    | "disputed"
    | "paid";
}

const PAID_STATUSES = new Set(["paid", "confirmed"]);

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
    const isPaid = PAID_STATUSES.has(item.status);
    if (isPaid) {
      paidCents += item.amountCents;
      paidCount += 1;
    }
    if (
      !isPaid &&
      item.status !== "awaiting_confirmation" &&
      item.dueDate < todayISO
    ) {
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
