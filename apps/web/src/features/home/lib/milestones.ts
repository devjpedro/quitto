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
  if (ms.settled.paidCents > 0) {
    cells.push({
      id: "settled_paid",
      cents: ms.settled.paidCents,
      totalCents: ms.settled.payableTotalCents,
    });
  }
  if (ms.settled.receivedCents > 0) {
    cells.push({
      id: "settled_received",
      cents: ms.settled.receivedCents,
      totalCents: ms.settled.receivableTotalCents,
    });
  }
  return cells;
}

export interface StripCell {
  cell: MilestoneCell;
  /** The milestone of the moment: the sidebar shows it from md, so the strip hides it there. */
  moment: boolean;
  /** Takes the whole row of the two-column grid (below lg). */
  wide: boolean;
}

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
  const moment = cells.find((cell) => cell.id === momentId);
  const rest = cells.filter((cell) => cell !== moment);
  const lead: StripCell[] = moment
    ? [{ cell: moment, moment: true, wide: true }]
    : [];
  return [
    ...lead,
    ...rest.map((cell, i) => ({
      cell,
      moment: false,
      wide: rest.length % 2 === 1 && i === rest.length - 1,
    })),
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

/** What is paid of the whole, in percent (0 to 100, rounded): "Já recebeu … 40%". */
export function sharePercent(cents: number, totalCents: number): number {
  if (totalCents <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((cents / totalCents) * 100)));
}
