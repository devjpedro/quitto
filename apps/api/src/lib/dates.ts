import type { Locale } from "@quitto/shared";

/** Parses an ISO date (YYYY-MM-DD) into year/month/day numbers (UTC-safe, no timezone drift). */
function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** Adds `days` to an ISO date (YYYY-MM-DD), UTC-safe. Returns ISO string. */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Identity helper kept for symmetry/readability in callers and tests. */
export function toISODate(iso: string): string {
  return iso;
}

const DATE_FORMATTERS = new Map<Locale, Intl.DateTimeFormat>();

/** Formats an ISO date (YYYY-MM-DD) for the locale ("10/07/2026" / "07/10/2026"), no timezone drift. */
export function formatISODate(iso: string, locale: Locale): string {
  let f = DATE_FORMATTERS.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
      year: "numeric",
    });
    DATE_FORMATTERS.set(locale, f);
  }
  const { y, m, d } = parseISODate(iso);
  return f.format(new Date(Date.UTC(y, m - 1, d)));
}

/** The last day of the ISO date's month (YYYY-MM-DD), leap years included. */
export function endOfMonth(iso: string): string {
  const { y, m } = parseISODate(iso);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
