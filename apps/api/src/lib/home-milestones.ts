import {
  DIRECTION,
  type Direction,
  INSTALLMENT_STATUS,
  isoDateInTimeZone,
  isPaidStatus,
} from "@quitto/shared";
import type { HomeInstallmentRow, PartyContract } from "./home-parties";

export interface ClosestToPayoff {
  contractId: string;
  paidCount: number;
  percent: number;
  title: string;
  totalCount: number;
}

export interface HomeMilestones {
  closestToPayoff: ClosestToPayoff | null;
  monthToDate: { month: string; paidCents: number; receivedCents: number };
  previousMonthAllClear: { month: string; paidCount: number } | null;
  /** Everything already paid, one total per direction (never summed together). */
  settled: { paidCents: number; receivedCents: number };
}

/** "2026-10" → "2026-09"; "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}

interface Tally {
  paidCents: number;
  paidCount: number;
  totalCents: number;
  totalCount: number;
}

function tally(installments: HomeInstallmentRow[]): Tally {
  const out: Tally = {
    paidCents: 0,
    paidCount: 0,
    totalCents: 0,
    totalCount: installments.length,
  };
  for (const it of installments) {
    out.totalCents += it.amountCents;
    if (isPaidStatus(it.status)) {
      out.paidCents += it.amountCents;
      out.paidCount += 1;
    }
  }
  return out;
}

function isCloser(
  candidate: ClosestToPayoff,
  remaining: number,
  best: { remaining: number; value: ClosestToPayoff }
): boolean {
  if (candidate.percent !== best.value.percent) {
    return candidate.percent > best.value.percent;
  }
  if (remaining !== best.remaining) {
    return remaining < best.remaining;
  }
  return candidate.title.localeCompare(best.value.title) < 0;
}

/** Paid share of an open contract: 1 to 99, so it never reads as done (100%) or untouched (0%). */
function openPercent(paidCents: number, totalCents: number): number {
  return Math.min(99, Math.max(1, Math.round((paidCents / totalCents) * 100)));
}

/** Open contract with the largest paid share (ties: fewer installments left, then title). Never-paid ones don't count. */
function closestToPayoff(parties: PartyContract[]): ClosestToPayoff | null {
  let best: { remaining: number; value: ClosestToPayoff } | null = null;
  for (const party of parties) {
    const t = tally(party.installments);
    if (
      t.paidCount === 0 ||
      t.paidCount === t.totalCount ||
      t.totalCents === 0
    ) {
      continue;
    }
    const value: ClosestToPayoff = {
      contractId: party.contract.id,
      title: party.contract.title,
      paidCount: t.paidCount,
      totalCount: t.totalCount,
      percent: openPercent(t.paidCents, t.totalCents),
    };
    const remaining = t.totalCount - t.paidCount;
    if (!best || isCloser(value, remaining, best)) {
      best = { value, remaining };
    }
  }
  return best?.value ?? null;
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
function movedAt(direction: Direction, it: HomeInstallmentRow): Date | null {
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

/** "Você já pagou" and "Já recebeu": what is paid in the contracts you pay, and in the ones you receive. */
function settledByDirection(
  parties: PartyContract[]
): HomeMilestones["settled"] {
  let paidCents = 0;
  let receivedCents = 0;
  for (const party of parties) {
    const cents = tally(party.installments).paidCents;
    if (party.direction === DIRECTION.pay) {
      paidCents += cents;
    } else {
      receivedCents += cents;
    }
  }
  return { paidCents, receivedCents };
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
