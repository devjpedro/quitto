import {
  type SumMismatch,
  scheduleTotal,
  spreadDifference,
  sumMismatch,
} from "@quitto/shared";
import {
  scheduleOf,
  type WizardInstallment,
  type WizardValues,
} from "./wizard-values";

/** A row the person changed: the new value, and the lime mark (mockup 15, D5). */
export function editRow(
  rows: readonly WizardInstallment[],
  index: number,
  patch: Partial<Pick<WizardInstallment, "amountCents" | "dueDate">>
): WizardInstallment[] {
  return rows.map((row, at) =>
    at === index ? { ...row, ...patch, edited: true } : row
  );
}

export interface AdjustState {
  count: number;
  /** Rows the person did not change: where "Tirar R$ X das outras N" goes. */
  freeCount: number;
  mismatch: SumMismatch | null;
  sum: number;
  /** The list with the difference spread over the free rows; null when it cannot be. */
  take: WizardInstallment[] | null;
  total: number;
  /** The values with the sum as the new total: only a total split (planner's decision 25). */
  useTotal: WizardValues | null;
}

/** The sum under the one-by-one list and its two one-tap fixes (owner's decision 9). */
export function adjustState(values: WizardValues): AdjustState | null {
  const schedule = scheduleOf(values);
  const rows = values.installments;
  if (!(schedule && rows)) {
    return null;
  }
  const amounts = rows.map((row) => row.amountCents ?? 0);
  const sum = amounts.reduce((acc, amount) => acc + amount, 0);
  const mismatch = sumMismatch(
    schedule,
    amounts.map((amountCents) => ({ amountCents }))
  );
  const spread = mismatch
    ? spreadDifference(
        amounts,
        rows.map((row) => row.edited),
        mismatch
      )
    : null;
  return {
    count: rows.length,
    freeCount: rows.filter((row) => !row.edited).length,
    mismatch,
    sum,
    take: spread
      ? rows.map((row, index) => ({
          ...row,
          amountCents: spread[index] ?? row.amountCents,
        }))
      : null,
    total: scheduleTotal(schedule),
    useTotal:
      mismatch && schedule.mode === "split"
        ? { ...values, totalCents: sum }
        : null,
  };
}
