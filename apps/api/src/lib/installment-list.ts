import {
  type Direction,
  INSTALLMENT_STATUS,
  isOverdue,
  isoDateInTimeZone,
  isPaidStatus,
} from "@quitto/shared";
import { movedAt } from "./home-milestones";
import type { HomeInstallmentRow, PartyContract } from "./home-parties";

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
  /**
   * The day the money moved for the caller (the same one the home's "Pago em
   * <mês>" counts, São Paulo's calendar); `null` while unpaid. "Pagas em
   * <mês>" lists by this day, not by the due date.
   */
  movedOn: string | null;
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

function inRange(day: string, from?: string, to?: string): boolean {
  return (!from || day >= from) && (!to || day <= to);
}

/** A paid installment is in the window by its due date or by the day the money moved. */
function inWindow(
  it: { dueDate: string; status: string },
  movedOn: string | null,
  { from, to, pastDue }: InstallmentFilter
): boolean {
  if (movedOn !== null && inRange(movedOn, from, to)) {
    return true;
  }
  if (to && it.dueDate > to) {
    return false;
  }
  if (!from || it.dueDate >= from) {
    return true;
  }
  return pastDue && !isPaidStatus(it.status);
}

function movedOnOf(
  direction: Direction,
  it: HomeInstallmentRow
): string | null {
  const at = movedAt(direction, it);
  return at === null ? null : isoDateInTimeZone(at);
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
      const movedOn = movedOnOf(party.direction, it);
      if (
        !inWindow(it, movedOn, filter) ||
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
        movedOn,
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
