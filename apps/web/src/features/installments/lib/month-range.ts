import type { Locale } from "@quitto/shared";
import { capitalize } from "@/lib/format";

const WEEK_AHEAD = 6;

/** "2026-10" from "2026-10-08". */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function parts(month: string): { month: number; year: number } {
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
}

/** The month `delta` months from `month` (any sign, across years). */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: number } = parts(month);
  const index = year * 12 + (number - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`;
}

/** The first and last day of a month. */
export function monthBounds(month: string): { from: string; to: string } {
  const { year, month: number } = parts(month);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

/** `iso` plus `days` calendar days, with no timezone drift. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The last day "Esta semana" reaches from `today`. */
export function weekEnd(today: string): string {
  return addDays(today, WEEK_AHEAD);
}

export interface MonthQuery {
  from: string;
  pastDue: boolean;
  to: string;
}

/**
 * What the list asks the API for. The current month carries the overdue of
 * earlier months (`pastDue`) and reaches `today + 6`, so "Esta semana" is
 * whole when the week crosses into the next month.
 */
export function monthQuery(month: string, today: string): MonthQuery {
  const bounds = monthBounds(month);
  if (month !== monthOf(today)) {
    return { ...bounds, pastDue: false };
  }
  const reach = weekEnd(today);
  return {
    from: bounds.from,
    to: reach > bounds.to ? reach : bounds.to,
    pastDue: true,
  };
}

/** "Outubro de 2026" / "October 2026". */
export function monthTitle(month: string, locale: Locale): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  return capitalize(formatted);
}
