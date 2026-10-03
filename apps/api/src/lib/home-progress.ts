import { INSTALLMENT_STATUS, isOverdue, isPaidStatus } from "@quitto/shared";
import type { HomeInstallmentRow } from "./home-parties";

/** Up to this many installments the card's bar has one segment each; above it, zones (DIRECAO › Progresso). */
export const BAR_SEGMENTS_MAX = 24;

export type BarStatus = "paid" | "overdue" | "review" | "today" | "open";

/** The whole contract, for the card's bar and its legend ("4 de 12 pagas · falta R$ 14.400,00"). */
export interface ContractSummary {
  overdueCount: number;
  paidCount: number;
  remainingCents: number;
  /** One per installment, by sequence; null above BAR_SEGMENTS_MAX (the bar draws zones from the counts). */
  statuses: BarStatus[] | null;
}

/**
 * A segment of the bar: paid wins; then a proof waiting, overdue, due today
 * and open. A disputed installment past due is "overdue" here (and on the
 * sidebar ring), though for the payer it is the "Contestada" card and stays
 * out of the overdue chip (OverdueTotals): planner's decision 21.
 */
export function barStatus(it: HomeInstallmentRow, todayISO: string): BarStatus {
  if (isPaidStatus(it.status)) {
    return "paid";
  }
  if (it.status === INSTALLMENT_STATUS.awaitingConfirmation) {
    return "review";
  }
  if (isOverdue(it.dueDate, it.status, todayISO)) {
    return "overdue";
  }
  return it.dueDate === todayISO ? "today" : "open";
}

export function contractSummary(
  installments: HomeInstallmentRow[],
  todayISO: string
): ContractSummary {
  const ordered = [...installments].sort((a, b) => a.sequence - b.sequence);
  const statuses = ordered.map((it) => barStatus(it, todayISO));
  let paidCount = 0;
  let overdueCount = 0;
  let remainingCents = 0;
  ordered.forEach((it, index) => {
    const status = statuses[index];
    if (status === "paid") {
      paidCount += 1;
    } else {
      remainingCents += it.amountCents;
    }
    if (status === "overdue") {
      overdueCount += 1;
    }
  });
  return {
    paidCount,
    overdueCount,
    remainingCents,
    statuses: ordered.length <= BAR_SEGMENTS_MAX ? statuses : null,
  };
}
