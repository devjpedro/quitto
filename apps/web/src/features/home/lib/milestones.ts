import type { HomeMilestones } from "../types";

export type MilestoneCell =
  | { id: "all_clear"; month: string; paidCount: number }
  | {
      contractId: string;
      id: "closest";
      nextDueDate: string | null;
      paidCount: number;
      percent: number;
      remainingCount: number;
      title: string;
      totalCount: number;
    }
  | { cents: number; id: "received" | "paid"; month: string }
  | {
      cents: number;
      id: "settled_paid" | "settled_received";
      totalCents: number;
    };

/** A cell the lime card can word: the four kinds of the milestone of the moment, never a settled total. */
export type MomentMilestoneCell = Extract<
  MilestoneCell,
  { id: "all_clear" | "closest" | "paid" | "received" }
>;

const MOMENT_CELL_IDS = new Set<MilestoneCell["id"]>([
  "all_clear",
  "closest",
  "paid",
  "received",
]);

export function isMomentMilestoneCell(
  cell: MilestoneCell
): cell is MomentMilestoneCell {
  return MOMENT_CELL_IDS.has(cell.id);
}

/**
 * Cells of the milestones strip, in order. Empty ones are left out: never a
 * zero on screen. What you paid and what you received are never summed: one
 * cell per direction, each only when it exists.
 */
export function milestoneCells(ms: HomeMilestones): MilestoneCell[] {
  const cells: MilestoneCell[] = [];
  if (ms.previousMonthAllClear) {
    cells.push({ id: "all_clear", ...ms.previousMonthAllClear });
  }
  if (ms.closestToPayoff) {
    cells.push({ id: "closest", ...ms.closestToPayoff });
  }
  if (ms.monthToDate.receivedCents > 0) {
    cells.push({
      id: "received",
      month: ms.monthToDate.month,
      cents: ms.monthToDate.receivedCents,
    });
  }
  if (ms.monthToDate.paidCents > 0) {
    cells.push({
      id: "paid",
      month: ms.monthToDate.month,
      cents: ms.monthToDate.paidCents,
    });
  }
  // Received before paid, like the month's pair (mockup 13).
  if (ms.settled.receivedCents > 0) {
    cells.push({
      id: "settled_received",
      cents: ms.settled.receivedCents,
      totalCents: ms.settled.receivableTotalCents,
    });
  }
  if (ms.settled.paidCents > 0) {
    cells.push({
      id: "settled_paid",
      cents: ms.settled.paidCents,
      totalCents: ms.settled.payableTotalCents,
    });
  }
  return cells;
}

/**
 * A cell in its place. `moment`: the milestone of the moment, on a row of its
 * own (the sidebar shows it from md, so the strip hides it there). `wide`:
 * takes the whole row of the two-column grid (below lg).
 */
export type StripCell =
  | { cell: MomentMilestoneCell; moment: true; wide: true }
  | { cell: MilestoneCell; moment: false; wide: boolean };

/**
 * The strip in order. The milestone of the moment, when it is one of the
 * cells, opens the strip on a row of its own; the rest go two by two, an odd
 * last one on a row of its own. Computed here rather than with `odd:last:`,
 * since a cell hidden by CSS would still count for the selector.
 */
export function stripCells(
  cells: MilestoneCell[],
  momentId: string | null
): StripCell[] {
  const moment = cells
    .filter(isMomentMilestoneCell)
    .find((cell) => cell.id === momentId);
  const rest = cells.filter((cell) => cell !== moment);
  const lead: StripCell[] = moment
    ? [{ cell: moment, moment: true, wide: true }]
    : [];
  return [
    ...lead,
    ...rest.map(
      (cell, i): StripCell => ({
        cell,
        moment: false,
        wide: rest.length % 2 === 1 && i === rest.length - 1,
      })
    ),
  ];
}

/**
 * True when the strip would hold only the milestone of the moment: then it is
 * a phone-only strip, because from md the sidebar's lime card shows that one.
 */
export function onlyMomentStrip(
  milestones: HomeMilestones,
  momentId: string | null
): boolean {
  const strip = stripCells(milestoneCells(milestones), momentId);
  return strip.length > 0 && strip.every((item) => item.moment);
}

/** True when the strip shows some cell from md (the side column has milestones to hold). */
export function stripHasCells(
  milestones: HomeMilestones,
  momentId: string | null
): boolean {
  return stripCells(milestoneCells(milestones), momentId).some(
    (item) => !item.moment
  );
}

/**
 * What is paid of the whole, in percent: "Já recebeu … 40%". While something
 * is still open it stays between 1 and 99, like the API's openPercent: never
 * "100%" before the end, never "0%" beside an amount.
 */
export function sharePercent(cents: number, totalCents: number): number {
  if (totalCents <= 0 || cents <= 0) {
    return 0;
  }
  if (cents >= totalCents) {
    return 100;
  }
  return Math.min(99, Math.max(1, Math.round((cents / totalCents) * 100)));
}
