import {
  DIRECTION,
  type Direction,
  INSTALLMENT_STATUS,
  isoDateInTimeZone,
  isPaidStatus,
} from "@quitto/shared";
import { type ClosestToPayoff, closestToPayoff } from "./home-closest";
import type { HomeInstallmentRow, PartyContract } from "./home-parties";
import { tally } from "./home-tally";

export type { ClosestToPayoff } from "./home-closest";

/** Paid so far and the whole value, one pair per direction: "Já recebeu R$ X · de R$ Y". */
export interface SettledTotals {
  paidCents: number;
  payableTotalCents: number;
  receivableTotalCents: number;
  receivedCents: number;
}

export interface HomeMilestones {
  closestToPayoff: ClosestToPayoff | null;
  monthToDate: { month: string; paidCents: number; receivedCents: number };
  previousMonthAllClear: { month: string; paidCount: number } | null;
  /** Everything already paid and the whole value, one pair per direction (never summed together). */
  settled: SettledTotals;
}

/** "2026-10" → "2026-09"; "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}

/**
 * When the payer acted. With confirmation, the latest proof (the one that got
 * confirmed), not the confirmation: confirm also writes paidAt, and a late
 * approver must not make the payer late. Without confirmation, paidAt is the
 * mark or the upload itself.
 */
function payerActedAt(it: HomeInstallmentRow): Date | null {
  if (it.status === INSTALLMENT_STATUS.confirmed) {
    return it.lastProofAt ?? it.paidAt;
  }
  return it.paidAt;
}

/**
 * When a paid installment counts as money moved for the caller. Paying, when
 * the payer acted (the same date "tudo em dia" uses), so a late confirmation
 * never moves a payment to the next month. Receiving, paidAt: the
 * confirmation, when the contract asks for one.
 */
export function movedAt(
  direction: Direction,
  it: HomeInstallmentRow
): Date | null {
  if (!isPaidStatus(it.status)) {
    return null;
  }
  return direction === DIRECTION.pay ? payerActedAt(it) : it.paidAt;
}

/** Paid and received this month, by when the money moved, on São Paulo's calendar. */
function monthToDate(
  parties: PartyContract[],
  month: string
): HomeMilestones["monthToDate"] {
  let paidCents = 0;
  let receivedCents = 0;
  for (const party of parties) {
    for (const it of party.installments) {
      const at = movedAt(party.direction, it);
      if (at === null || !isoDateInTimeZone(at).startsWith(month)) {
        continue;
      }
      if (party.direction === DIRECTION.pay) {
        paidCents += it.amountCents;
      } else {
        receivedCents += it.amountCents;
      }
    }
  }
  return { month, paidCents, receivedCents };
}

/** Paid by its due date, on São Paulo's calendar. A paid row without any date (legacy) is not on time. */
function paidOnTime(it: HomeInstallmentRow): boolean {
  if (!isPaidStatus(it.status)) {
    return false;
  }
  const actedAt = payerActedAt(it);
  return actedAt !== null && isoDateInTimeZone(actedAt) <= it.dueDate;
}

/** "Tudo em dia em <mês>": every installment due that month was paid by its due date, and there was at least one. */
function monthAllClear(
  parties: PartyContract[],
  month: string
): HomeMilestones["previousMonthAllClear"] {
  const due = parties
    .flatMap((p) => p.installments)
    .filter((it) => it.dueDate.startsWith(month));
  if (due.length === 0 || !due.every((it) => paidOnTime(it))) {
    return null;
  }
  return { month, paidCount: due.length };
}

/** "Você já pagou" and "Já recebeu", each with the whole value of its contracts, open and settled. */
function settledByDirection(parties: PartyContract[]): SettledTotals {
  const out: SettledTotals = {
    paidCents: 0,
    payableTotalCents: 0,
    receivedCents: 0,
    receivableTotalCents: 0,
  };
  for (const party of parties) {
    const t = tally(party.installments);
    if (party.direction === DIRECTION.pay) {
      out.paidCents += t.paidCents;
      out.payableTotalCents += t.totalCents;
    } else {
      out.receivedCents += t.paidCents;
      out.receivableTotalCents += t.totalCents;
    }
  }
  return out;
}

export function buildMilestones(
  parties: PartyContract[],
  todayISO: string
): HomeMilestones {
  const month = todayISO.slice(0, 7);
  return {
    closestToPayoff: closestToPayoff(parties),
    monthToDate: monthToDate(parties, month),
    previousMonthAllClear: monthAllClear(parties, previousMonth(month)),
    settled: settledByDirection(parties),
  };
}
