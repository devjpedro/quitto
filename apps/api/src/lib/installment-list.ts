import {
  type Direction,
  INSTALLMENT_STATUS,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";
import type { PartyContract } from "./home-parties";

export type InstallmentListStatus = "overdue" | "awaiting" | "open" | "paid";

export interface InstallmentFilter {
  direction?: Direction;
  from?: string;
  /** With `from`: also every unpaid installment due before it. */
  pastDue: boolean;
  status?: InstallmentListStatus;
  to?: string;
}

export interface InstallmentListItem {
  amountCents: number;
  contractId: string;
  contractTitle: string;
  counterpartyName: string | null;
  direction: Direction;
  dueDate: string;
  installmentId: string;
  installmentsCount: number;
  paidAt: string | null;
  sequence: number;
  status: string;
}

const collator = new Intl.Collator("pt-BR");

function matchesStatus(
  status: InstallmentListStatus,
  it: { dueDate: string; status: string },
  today: string
): boolean {
  switch (status) {
    case "overdue":
      return isOverdue(it.dueDate, it.status, today);
    case "awaiting":
      return it.status === INSTALLMENT_STATUS.awaitingConfirmation;
    case "paid":
      return isPaidStatus(it.status);
    case "open":
      return !(
        isPaidStatus(it.status) || isOverdue(it.dueDate, it.status, today)
      );
    default:
      return true;
  }
}

function inWindow(
  it: { dueDate: string; status: string },
  { from, to, pastDue }: InstallmentFilter
): boolean {
  if (to && it.dueDate > to) {
    return false;
  }
  if (!from || it.dueDate >= from) {
    return true;
  }
  return pastDue && !isPaidStatus(it.status);
}

/** The caller's installments (a side to pay or receive, never a followed contract), by window, side and state. Pure. */
export function listInstallments(
  parties: PartyContract[],
  filter: InstallmentFilter,
  today: string
): InstallmentListItem[] {
  const items: InstallmentListItem[] = [];
  for (const party of parties) {
    if (filter.direction && party.direction !== filter.direction) {
      continue;
    }
    for (const it of party.installments) {
      if (
        !inWindow(it, filter) ||
        (filter.status && !matchesStatus(filter.status, it, today))
      ) {
        continue;
      }
      items.push({
        installmentId: it.id,
        contractId: party.contract.id,
        contractTitle: party.contract.title,
        sequence: it.sequence,
        installmentsCount: party.contract.installmentsCount,
        amountCents: it.amountCents,
        dueDate: it.dueDate,
        status: it.status,
        direction: party.direction,
        counterpartyName: party.counterpartyName,
        paidAt: it.paidAt ? it.paidAt.toISOString() : null,
      });
    }
  }
  return items.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      collator.compare(a.contractTitle, b.contractTitle) ||
      a.sequence - b.sequence
  );
}
