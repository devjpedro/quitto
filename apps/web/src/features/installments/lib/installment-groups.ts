import { INSTALLMENT_STATUS, isPaidStatus } from "@quitto/shared";
import type { InstallmentListItem } from "../types";
import { weekEnd } from "./month-range";

export type GroupId = "overdue" | "awaiting" | "week" | "month" | "paid";

/** A line of the list: one installment (the owner took the runs of overdue ones out: one line each). */
export interface InstallmentLine {
  id: string;
  items: InstallmentListItem[];
}

export interface InstallmentGroup {
  id: GroupId;
  /** Every installment of the group. */
  items: InstallmentListItem[];
  lines: InstallmentLine[];
  payCents: number;
  receiveCents: number;
}

export type InstallmentFilter = "pay" | "receive" | "overdue" | "awaiting";

const ORDER: GroupId[] = ["overdue", "awaiting", "week", "month", "paid"];

/** Which group an installment belongs to (D9); `null` for a paid one that is not of the month. */
function groupOf(
  item: InstallmentListItem,
  month: string,
  today: string
): GroupId | null {
  if (isPaidStatus(item.status)) {
    return item.dueDate.startsWith(month) ? "paid" : null;
  }
  if (item.dueDate < today) {
    return item.status === INSTALLMENT_STATUS.awaitingConfirmation
      ? "awaiting"
      : "overdue";
  }
  if (item.dueDate <= weekEnd(today)) {
    return "week";
  }
  // Past the week, only the month on screen's own (the API sends nothing else).
  return item.dueDate.startsWith(month) ? "month" : null;
}

function totals(items: InstallmentListItem[]) {
  let payCents = 0;
  let receiveCents = 0;
  for (const item of items) {
    if (item.direction === "pay") {
      payCents += item.amountCents;
    } else {
      receiveCents += item.amountCents;
    }
  }
  return { payCents, receiveCents };
}

/**
 * The month's installments by urgency (D9): Atrasadas, Aguardando
 * confirmação, Esta semana, Ainda em <mês>, Pagas. A group with nothing is
 * gone. The chips' counts are of the month without the filter.
 */
export function groupInstallments(
  items: InstallmentListItem[],
  {
    filter,
    month,
    today,
  }: { filter?: InstallmentFilter; month: string; today: string }
): {
  counts: { awaiting: number; overdue: number };
  groups: InstallmentGroup[];
} {
  const placed = items.flatMap((item) => {
    const id = groupOf(item, month, today);
    return id ? [{ id, item }] : [];
  });
  const overdueAll = placed
    .filter((p) => p.id === "overdue")
    .map((p) => p.item);
  const counts = {
    overdue: overdueAll.length,
    awaiting: placed.filter(
      (p) => p.item.status === INSTALLMENT_STATUS.awaitingConfirmation
    ).length,
  };
  const shown = placed.filter(({ id, item }) => {
    if (filter === "pay" || filter === "receive") {
      return item.direction === filter;
    }
    if (filter === "overdue") {
      return id === "overdue";
    }
    if (filter === "awaiting") {
      return item.status === INSTALLMENT_STATUS.awaitingConfirmation;
    }
    return true;
  });
  const groups = ORDER.flatMap((id) => {
    const members = shown.filter((p) => p.id === id).map((p) => p.item);
    if (members.length === 0) {
      return [];
    }
    const lines = members.map((item) => ({
      id: item.installmentId,
      items: [item],
    }));
    return [{ id, items: members, lines, ...totals(members) }];
  });
  return { counts, groups };
}

/** Whether a month is the one `today` falls in. */
export function isCurrentMonth(month: string, today: string): boolean {
  return month === today.slice(0, 7);
}

/**
 * The calendar's filter: the same chips as the list, on the installments
 * themselves (a chip never hides a whole group here, only marks).
 */
export function filterItems(
  items: InstallmentListItem[],
  filter: InstallmentFilter | undefined,
  today: string
): InstallmentListItem[] {
  if (!filter) {
    return items;
  }
  return items.filter((item) => {
    if (filter === "pay" || filter === "receive") {
      return item.direction === filter;
    }
    if (filter === "awaiting") {
      return item.status === INSTALLMENT_STATUS.awaitingConfirmation;
    }
    return (
      !isPaidStatus(item.status) &&
      item.status !== INSTALLMENT_STATUS.awaitingConfirmation &&
      item.dueDate < today
    );
  });
}
