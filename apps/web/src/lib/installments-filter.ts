import { isOverdue, isPaidStatus } from "@quitto/shared";

export type InstallmentFilter = "all" | "due" | "overdue" | "paid";

interface FilterableInstallment {
  dueDate: string;
  status: string;
}

export function matchesFilter(
  item: FilterableInstallment,
  filter: InstallmentFilter,
  todayISO: string
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "due":
      return !isPaidStatus(item.status);
    case "overdue":
      return isOverdue(item.dueDate, item.status, todayISO);
    case "paid":
      return isPaidStatus(item.status);
    default:
      return false;
  }
}

export function filterInstallments<T extends FilterableInstallment>(
  items: T[],
  filter: InstallmentFilter,
  todayISO: string
): T[] {
  return items.filter((it) => matchesFilter(it, filter, todayISO));
}

export function countByFilter(
  items: FilterableInstallment[],
  todayISO: string
): Record<InstallmentFilter, number> {
  const counts: Record<InstallmentFilter, number> = {
    all: items.length,
    due: 0,
    overdue: 0,
    paid: 0,
  };
  for (const it of items) {
    if (isPaidStatus(it.status)) {
      counts.paid += 1;
    } else {
      counts.due += 1;
    }
    if (isOverdue(it.dueDate, it.status, todayISO)) {
      counts.overdue += 1;
    }
  }
  return counts;
}
