/** Parses an ISO date (YYYY-MM-DD) into year/month/day numbers (UTC-safe, no timezone drift). */
function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Adds `months` to an ISO date, clamping the day to the target month's last day. Returns ISO string. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseISODate(iso);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
