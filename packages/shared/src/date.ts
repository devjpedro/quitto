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
