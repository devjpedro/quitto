/** The most installments the invite card lists; the rest is "and the others". */
export const STAGE_ROWS = 4;

/**
 * The first due dates of an invite whose parcels fall monthly from the first
 * (the public preview has no schedule): the same day each month, clamped to
 * the month's last day ("2026-01-31" → "2026-02-28").
 */
export function monthlyDates(firstISO: string, count: number): string[] {
  const [year = 0, month = 1, day = 1] = firstISO.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = month - 1 + i;
    const y = year + Math.floor(index / 12);
    const mo = (index % 12) + 1;
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const dd = Math.min(day, last);
    dates.push(
      `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
    );
  }
  return dates;
}
