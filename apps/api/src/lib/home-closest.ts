import { isPaidStatus } from "@quitto/shared";
import type { HomeInstallmentRow, PartyContract } from "./home-parties";
import { tally } from "./home-tally";

/** "Mais perto de quitar" only from half paid (owner's decision 4): 7% paid is not an achievement. */
export const CLOSEST_MIN_PERCENT = 50;

export interface ClosestToPayoff {
  contractId: string;
  /** The next open installment's due date: "Falta 1 parcela, em 13/10". */
  nextDueDate: string | null;
  paidCount: number;
  percent: number;
  remainingCount: number;
  title: string;
  totalCount: number;
}

/**
 * Paid share of an open contract, rounded as the screen shows it, up to 99 so
 * it never reads as done (100%). No floor: below CLOSEST_MIN_PERCENT there is
 * no milestone, and the cut compares this same number (planner's decision 5).
 */
function openPercent(paidCents: number, totalCents: number): number {
  return Math.min(99, Math.round((paidCents / totalCents) * 100));
}

function nextOpenDueDate(installments: HomeInstallmentRow[]): string | null {
  let next: string | null = null;
  for (const it of installments) {
    if (!isPaidStatus(it.status) && (next === null || it.dueDate < next)) {
      next = it.dueDate;
    }
  }
  return next;
}

function isCloser(candidate: ClosestToPayoff, best: ClosestToPayoff): boolean {
  if (candidate.percent !== best.percent) {
    return candidate.percent > best.percent;
  }
  if (candidate.remainingCount !== best.remainingCount) {
    return candidate.remainingCount < best.remainingCount;
  }
  return candidate.title.localeCompare(best.title) < 0;
}

/**
 * The open contract with the largest paid share, from half paid on (ties:
 * fewer installments left, then title). Never-paid and fully paid contracts
 * don't count, and below CLOSEST_MIN_PERCENT there is no milestone: the
 * lime card moves on to the next one in its priority.
 */
export function closestToPayoff(
  parties: PartyContract[]
): ClosestToPayoff | null {
  let best: ClosestToPayoff | null = null;
  for (const party of parties) {
    const t = tally(party.installments);
    if (
      t.paidCount === 0 ||
      t.paidCount === t.totalCount ||
      t.totalCents === 0
    ) {
      continue;
    }
    const percent = openPercent(t.paidCents, t.totalCents);
    if (percent < CLOSEST_MIN_PERCENT) {
      continue;
    }
    const value: ClosestToPayoff = {
      contractId: party.contract.id,
      title: party.contract.title,
      paidCount: t.paidCount,
      totalCount: t.totalCount,
      percent,
      remainingCount: t.totalCount - t.paidCount,
      nextDueDate: nextOpenDueDate(party.installments),
    };
    if (!best || isCloser(value, best)) {
      best = value;
    }
  }
  return best;
}
