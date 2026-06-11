import { addMonths } from "./dates";
import { splitAmount } from "./money";

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
