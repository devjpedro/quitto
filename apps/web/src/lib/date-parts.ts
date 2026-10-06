import type { Locale } from "@quitto/shared";

const monthFormatters = new Map<Locale, Intl.DateTimeFormat>();
const weekdayFormatters = new Map<Locale, Intl.DateTimeFormat>();

function formatterFor(
  cache: Map<Locale, Intl.DateTimeFormat>,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  let formatter = cache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: "UTC",
    });
    cache.set(locale, formatter);
  }
  return formatter;
}

/** A calendar date at UTC midnight: formatting it in UTC never shifts the day. */
function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** "13" from "2026-10-13": the date tile's big number, two digits as in mockup 13. */
export function dayOfMonth(iso: string): string {
  return iso.slice(8, 10);
}

/** "out" / "Oct": the date tile's month, without pt-BR's abbreviation dot. */
export function monthShort(iso: string, locale: Locale): string {
  return formatterFor(monthFormatters, locale, { month: "short" })
    .format(utc(iso))
    .replace(".", "");
}

/** "ter." / "Tue": the weekday of a due date, in a list row's meta. */
export function weekdayName(iso: string, locale: Locale): string {
  return formatterFor(weekdayFormatters, locale, { weekday: "short" }).format(
    utc(iso)
  );
}

/** "mar/2027" / "Mar/2027": the month a contract ends, in the bar's key. */
export function monthYearShort(iso: string, locale: Locale): string {
  return `${monthShort(iso, locale)}/${iso.slice(0, 4)}`;
}
