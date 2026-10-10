import { scheduleTotal, spreadDifference, sumMismatch } from "@quitto/shared";
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
  /** Rows the person did not change: where "Manter R$ Y" takes the difference from. */
  freeCount: number;
  /** The list with the difference spread over the free rows ("Manter R$ Y"); null when it cannot be. */
  keep: WizardInstallment[] | null;
  /** The sum differs from the total the person agreed on (mockup 20, B7): it never blocks. */
  moved: boolean;
  /** The agreed total, "era R$ Y". */
  previous: number;
  /** The new total: what the rows add up to. */
  sum: number;
}

/** The new total under the one-by-one list, and the way back to the old one (owner's decision, mockup 20, B7). */
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
    moved: mismatch !== null,
    previous: scheduleTotal(schedule),
    keep: spread
      ? rows.map((row, index) => ({
          ...row,
          amountCents: spread[index] ?? row.amountCents,
        }))
      : null,
    sum,
  };
}
