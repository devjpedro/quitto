import { INSTALLMENT_STATUS, isPaidStatus } from "@quitto/shared";
import type { BarStatus } from "@/components/ui/installment-bar";
import type { InstallmentListItem } from "../types";
import { addDays, monthBounds } from "./month-range";

export interface CalendarDay {
  inMonth: boolean;
  iso: string;
  isToday: boolean;
  items: InstallmentListItem[];
}

const WEEK = 7;

/**
 * The month as weeks, Sunday to Saturday (5 or 6 rows). The days of the
 * neighbour months only complete the ends and carry nothing; only the
 * installments due inside the month are placed (the overdue of earlier months
 * are not on the grid).
 */
export function calendarMonth(
  month: string,
  items: InstallmentListItem[],
  today: string
): CalendarDay[][] {
  const { from, to } = monthBounds(month);
  const lead = new Date(`${from}T00:00:00Z`).getUTCDay();
  const start = addDays(from, -lead);
  const byDay = new Map<string, InstallmentListItem[]>();
  for (const item of items) {
    if (item.dueDate >= from && item.dueDate <= to) {
      byDay.set(item.dueDate, [...(byDay.get(item.dueDate) ?? []), item]);
    }
  }
  const days = Number(to.slice(8, 10));
  const rows = Math.ceil((lead + days) / WEEK);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: WEEK }, (_, col): CalendarDay => {
      const iso = addDays(start, row * WEEK + col);
      const inMonth = iso >= from && iso <= to;
      return {
        iso,
        inMonth,
        isToday: iso === today,
        items: inMonth ? (byDay.get(iso) ?? []) : [],
      };
    })
  );
}

/** The day the list under the grid starts on: today if it is in the month, else the first with an installment, else the 1st. */
export function defaultDay(
  month: string,
  today: string,
  items: InstallmentListItem[]
): string {
  const { from, to } = monthBounds(month);
  if (today >= from && today <= to) {
    return today;
  }
  const first = items
    .map((item) => item.dueDate)
    .filter((date) => date >= from && date <= to)
    .sort()[0];
  return first ?? from;
}

/** An installment's mark on the grid, the same states as the bar. */
export function markOf(item: InstallmentListItem, today: string): BarStatus {
  if (isPaidStatus(item.status)) {
    return "paid";
  }
  if (item.status === INSTALLMENT_STATUS.awaitingConfirmation) {
    return "review";
  }
  if (item.dueDate < today) {
    return "overdue";
  }
  return item.dueDate === today ? "today" : "open";
}
