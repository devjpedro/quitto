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

export interface GenerateMonthlyScheduleInput {
  firstDueDate: string;
  monthlyAmountCents: number;
  months: number;
}

/** Builds N equal installments of exactly `monthlyAmountCents` with monthly due dates. */
export function generateMonthlySchedule(
  input: GenerateMonthlyScheduleInput
): ScheduleRow[] {
  return generateSchedule({
    totalAmountCents: input.monthlyAmountCents * input.months,
    installmentsCount: input.months,
    firstDueDate: input.firstDueDate,
  });
}

/** The schedule as the product speaks it (spec §5): a total split in N, or a fixed amount for N months. */
export type ScheduleInput =
  | {
      firstDueDate: string;
      installmentsCount: number;
      mode: "split";
      totalAmountCents: number;
    }
  | {
      firstDueDate: string;
      mode: "monthly";
      monthlyAmountCents: number;
      months: number;
    };

/** How many installments the schedule has. */
export function scheduleCount(schedule: ScheduleInput): number {
  return schedule.mode === "split"
    ? schedule.installmentsCount
    : schedule.months;
}

/** What the installments must add up to: the total, or the month's amount times the months. */
export function scheduleTotal(schedule: ScheduleInput): number {
  return schedule.mode === "split"
    ? schedule.totalAmountCents
    : schedule.monthlyAmountCents * schedule.months;
}

/**
 * The installments of a schedule: the rows the person adjusted one by one
 * when there are any, otherwise the generated ones. The server stores and
 * the wizard's preview shows exactly this (planner's decision 6).
 */
export function buildSchedule(
  schedule: ScheduleInput,
  rows?: readonly { amountCents: number; dueDate: string }[] | null
): ScheduleRow[] {
  if (rows && rows.length > 0) {
    return rows.map((row, index) => ({
      sequence: index + 1,
      amountCents: row.amountCents,
      dueDate: row.dueDate,
    }));
  }
  if (schedule.mode === "split") {
    return generateSchedule({
      totalAmountCents: schedule.totalAmountCents,
      installmentsCount: schedule.installmentsCount,
      firstDueDate: schedule.firstDueDate,
    });
  }
  return generateMonthlySchedule({
    monthlyAmountCents: schedule.monthlyAmountCents,
    months: schedule.months,
    firstDueDate: schedule.firstDueDate,
  });
}

export interface SumMismatch {
  /** Always positive, in cents. */
  diff: number;
  direction: "over" | "under";
}

/** How far the adjusted installments are from the schedule's total; null when they add up. */
export function sumMismatch(
  schedule: ScheduleInput,
  rows: readonly { amountCents: number }[]
): SumMismatch | null {
  const sum = rows.reduce((acc, row) => acc + row.amountCents, 0);
  const diff = sum - scheduleTotal(schedule);
  if (diff === 0) {
    return null;
  }
  return { diff: Math.abs(diff), direction: diff > 0 ? "over" : "under" };
}

/**
 * "Tirar R$ X das outras N": the difference spread over the installments the
 * person did not change, the leftover cents on the first of them (as
 * splitAmount does). Null when none is free or one would go under 1 cent.
 */
export function spreadDifference(
  amounts: readonly number[],
  edited: readonly boolean[],
  mismatch: SumMismatch
): number[] | null {
  const free: number[] = [];
  for (let index = 0; index < amounts.length; index += 1) {
    if (!edited[index]) {
      free.push(index);
    }
  }
  if (free.length === 0) {
    return null;
  }
  const parts = splitAmount(mismatch.diff, free.length);
  const next = [...amounts];
  for (let k = 0; k < free.length; k += 1) {
    const at = free[k] as number;
    const delta = parts[k] ?? 0;
    next[at] =
      (next[at] ?? 0) + (mismatch.direction === "over" ? -delta : delta);
  }
  return next.every((value) => value >= 1) ? next : null;
}
