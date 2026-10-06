import { sumMismatch } from "@quitto/shared";
import type { PreviewModel } from "@/components/preview/types";
import type { BarStatus } from "@/components/ui/installment-bar";
import { scheduleSummary } from "@/lib/schedule-summary";
import { rowsOf, scheduleOf, type WizardValues } from "./wizard-values";

/** Past 24 installments the bar goes by zones (DIRECAO › Progresso). */
const SEGMENTS_MAX = 24;

function barStatus(dueDate: string, today: string): BarStatus {
  if (dueDate < today) {
    return "overdue";
  }
  return dueDate === today ? "today" : "open";
}

/**
 * The wizard's live preview: the contract as it will look (mockup 15 §1.1).
 * Installments before today are already overdue on the bar (owner's
 * decision 8: a past first due date is a warning, and that is what it means).
 */
export function wizardPreview(
  values: WizardValues,
  today: string
): PreviewModel {
  const schedule = scheduleOf(values);
  const rows = rowsOf(values);
  let side: PreviewModel["side"] = null;
  if (values.ownerRole === "seller") {
    side = "receive";
  } else if (values.ownerRole === "buyer") {
    side = "pay";
  }
  let person: PreviewModel["person"] = null;
  if (values.party === "solo") {
    person = { kind: "solo" };
  } else if (values.party === "other" && values.counterpartyName.trim()) {
    person = { kind: "other", name: values.counterpartyName.trim() };
  }
  return {
    side,
    title: values.title.trim() || null,
    description: values.description.trim() || null,
    totalCents:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.amountCents, 0)
        : null,
    summary: scheduleSummary(rows),
    person,
    rows: rows.slice(0, 3).map((row) => ({
      ...row,
      adjusted: values.installments?.[row.sequence - 1]?.edited ?? false,
    })),
    count: rows.length,
    lastDueDate: rows.at(-1)?.dueDate ?? null,
    statuses:
      rows.length > 0 && rows.length <= SEGMENTS_MAX
        ? rows.map((row) => barStatus(row.dueDate, today))
        : null,
    overdueCount: rows.filter((row) => row.dueDate < today).length,
    mismatch: Boolean(
      schedule && values.installments && sumMismatch(schedule, rows)
    ),
  };
}
