import type { PreviewModel } from "@/components/preview/types";
import type { BarStatus } from "@/components/ui/installment-bar";
import { scheduleSummary } from "@/lib/schedule-summary";
import { paidSequencesOf, rowsOf, type WizardValues } from "./wizard-values";

/** Past 24 installments the bar goes by zones (DIRECAO › Progresso). */
const SEGMENTS_MAX = 24;

function barStatus(dueDate: string, today: string, paid: boolean): BarStatus {
  if (paid) {
    return "paid";
  }
  if (dueDate < today) {
    return "overdue";
  }
  return dueDate === today ? "today" : "open";
}

/**
 * The wizard's live preview: the contract as it will look (mockup 15 §1.1).
 * Installments before today are overdue on the bar unless the person said
 * they were already paid: those come painted as paid, with the progress.
 */
export function wizardPreview(
  values: WizardValues,
  today: string
): PreviewModel {
  const rows = rowsOf(values);
  const paid = new Set(paidSequencesOf(values, today));
  // The card lists what is still to come; every one paid, it lists the first.
  const open = rows.filter((row) => !paid.has(row.sequence));
  const listed = (open.length > 0 ? open : rows).slice(0, 3);
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
    rows: listed.map((row) => ({
      ...row,
      adjusted: values.installments?.[row.sequence - 1]?.edited ?? false,
    })),
    count: rows.length,
    lastDueDate: rows.at(-1)?.dueDate ?? null,
    statuses:
      rows.length > 0 && rows.length <= SEGMENTS_MAX
        ? rows.map((row) =>
            barStatus(row.dueDate, today, paid.has(row.sequence))
          )
        : null,
    paidCount: paid.size,
    overdueCount: rows.filter(
      (row) => row.dueDate < today && !paid.has(row.sequence)
    ).length,
  };
}
