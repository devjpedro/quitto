/** The product's reference timezone (Brazil). Dates ("today", overdue) are computed here, not in UTC. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Formats an instant as an ISO date (YYYY-MM-DD) in the given timezone, avoiding UTC ±1 drift. */
export function isoDateInTimeZone(
  date: Date,
  timeZone: string = APP_TIME_ZONE
): string {
  // en-CA renders as YYYY-MM-DD; timeZone shifts the wall-clock date correctly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's date as YYYY-MM-DD in the app's timezone. */
export function todayISO(timeZone: string = APP_TIME_ZONE): string {
  return isoDateInTimeZone(new Date(), timeZone);
}

/** A YYYY-MM-DD that is a real calendar day (rejects 2027-02-31 and month 13). */
export function isRealISODate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  if (!(y && m && d)) {
    return false;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
