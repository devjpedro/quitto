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

/** Splits a total (in cents) into `count` parts; the remainder cents go to the first parts. */
export function splitAmount(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("count must be a positive integer");
  }
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

export interface ScheduleRow {
  amountCents: number;
  dueDate: string;
  sequence: number;
}

export interface GenerateScheduleInput {
  firstDueDate: string;
  installmentsCount: number;
  totalAmountCents: number;
}

/** Builds an equal-split monthly schedule. For variable amounts, callers pass rows directly (custom mode). */
export function generateSchedule(input: GenerateScheduleInput): ScheduleRow[] {
  const amounts = splitAmount(input.totalAmountCents, input.installmentsCount);
  return amounts.map((amountCents, i) => ({
    sequence: i + 1,
    amountCents,
    dueDate: addMonths(input.firstDueDate, i),
  }));
}
