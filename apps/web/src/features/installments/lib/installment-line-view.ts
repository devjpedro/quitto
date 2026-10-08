import { INSTALLMENT_STATUS, isPaidStatus, type Locale } from "@quitto/shared";
import { formatRelativeDays } from "@/lib/locale-format";
import { sequencesLabel } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { InstallmentListItem } from "../types";
import type { GroupId, InstallmentLine } from "./installment-groups";

export interface LineTag {
  icon: "overdue" | "review" | null;
  label: string;
  tone: "danger" | "ink" | "warning";
}

export interface InstallmentLineView {
  /** "há 35 dias", only in Atrasadas. */
  ago: string | null;
  /** The signed side of the amount: money in or out. */
  amountCents: number;
  direction: "pay" | "receive";
  /** More than one installment on the line. */
  run: number;
  sequences: string;
  tag: LineTag | null;
  /** The date on the tile: the oldest of the line. */
  tileDate: string;
  title: string;
}

/**
 * The tag says what the group's title does not (D10): a proof waiting, a
 * dispute, due today. Never "Atrasada" in Atrasadas, never "Paga" in Pagas.
 */
function tagOf(item: InstallmentListItem, today: string): LineTag | null {
  if (item.status === INSTALLMENT_STATUS.awaitingConfirmation) {
    let label = m.contract_tag_review_view();
    if (item.direction === "receive") {
      label = m.contract_tag_review_receive();
    } else if (item.counterpartyName) {
      label = m.contract_tag_review_pay({
        name: item.counterpartyName.split(" ")[0] ?? item.counterpartyName,
      });
    }
    return { icon: "review", label, tone: "warning" };
  }
  if (item.status === INSTALLMENT_STATUS.disputed) {
    return {
      icon: "overdue",
      label: m.contract_tag_disputed(),
      tone: "danger",
    };
  }
  if (item.dueDate === today && !isPaidStatus(item.status)) {
    return { icon: null, label: m.contract_tag_today(), tone: "ink" };
  }
  return null;
}

/** What a line of the list draws (mockup 17, frame C). */
export function installmentLineView(
  line: InstallmentLine,
  group: GroupId,
  today: string,
  locale: Locale
): InstallmentLineView {
  const [first] = line.items;
  if (!first) {
    throw new Error("a line has at least one installment");
  }
  const oldest = line.items.reduce((a, b) => (b.dueDate < a.dueDate ? b : a));
  return {
    amountCents: line.items.reduce((sum, it) => sum + it.amountCents, 0),
    ago:
      group === "overdue"
        ? formatRelativeDays(oldest.dueDate, today, locale)
        : null,
    direction: first.direction,
    run: line.items.length,
    sequences: sequencesLabel(
      line.items.map((it) => it.sequence),
      first.installmentsCount,
      locale
    ),
    tag: line.items.length === 1 ? tagOf(first, today) : null,
    tileDate: oldest.dueDate,
    title: first.contractTitle,
  };
}
