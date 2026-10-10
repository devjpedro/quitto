import type { Locale } from "@quitto/shared";
import { monthYearShort, sinceDate } from "@/lib/date-parts";
import { sequencesText } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { ContractListItem } from "../types";

export type CardTagTone = "brand" | "danger" | "warning" | "ink";
export type CardTagIcon = "check" | "overdue" | "review";

export interface CardTag {
  icon: CardTagIcon | null;
  label: string;
  tone: CardTagTone;
}

/** The amount beside the arrow: what is left, or the total once the contract is settled. */
export interface CardRemaining {
  cents: number;
  label: string;
}

export interface ContractCardView {
  footer: string;
  percent: number;
  percentLabel: string;
  remaining: CardRemaining;
  role: { label: string; tone: "neutral" | "brand" | "sunken" };
  tags: CardTag[];
}

function roleOf(direction: ContractListItem["direction"]) {
  if (direction === "pay") {
    return { label: m.contracts_role_pay(), tone: "neutral" } as const;
  }
  if (direction === "receive") {
    return { label: m.contracts_role_receive(), tone: "brand" } as const;
  }
  return { label: m.contracts_role_view(), tone: "sunken" } as const;
}

function percentLabel(direction: ContractListItem["direction"]): string {
  if (direction === "pay") {
    return m.contracts_percent_pay();
  }
  return direction === "receive"
    ? m.contracts_percent_receive()
    : m.contracts_percent_view();
}

function remainingOf(item: ContractListItem): CardRemaining {
  return item.settled
    ? { label: m.contracts_cell_total(), cents: item.totalCents }
    : { label: m.contracts_cell_left(), cents: item.remainingCents };
}

/** The overdue sequences, from the bar when there is one, else just the oldest. */
function overdueSequences(item: ContractListItem): number[] {
  const fromBar = (item.statuses ?? []).flatMap((status, index) =>
    status === "overdue" ? [index + 1] : []
  );
  if (fromBar.length > 0) {
    return fromBar;
  }
  return item.oldestOverdue ? [item.oldestOverdue.sequence] : [];
}

function overdueFooter(
  item: ContractListItem,
  today: string,
  locale: Locale
): string {
  const overdue = item.oldestOverdue;
  if (!overdue) {
    return "";
  }
  const date = sinceDate(overdue.dueDate, today, locale);
  const sequences = overdueSequences(item);
  if (sequences.length <= 1) {
    return m.contracts_footer_overdue_one({
      sequence: overdue.sequence,
      date,
    });
  }
  const text = sequencesText(sequences, locale);
  return text.kind === "list"
    ? m.contracts_footer_overdue_list({ list: text.text, date })
    : m.contracts_footer_overdue_spread({ n: text.n, date });
}

function tagsOf(item: ContractListItem, today: string): CardTag[] {
  if (item.settled) {
    return [{ icon: "check", label: m.contracts_tag_settled(), tone: "brand" }];
  }
  const tags: CardTag[] = [];
  if (item.oldestOverdue) {
    tags.push({
      icon: "overdue",
      label:
        item.overdueCount > 1
          ? m.contracts_tag_overdue_many({ count: item.overdueCount })
          : m.contract_tag_overdue(),
      tone: "danger",
    });
  }
  if (item.reviewCount > 0) {
    const receive = item.direction === "receive";
    const alone = tags.length === 0;
    let label = m.contract_tag_review_view();
    if (receive) {
      label = alone
        ? m.contract_tag_review_receive()
        : m.contracts_tag_review_short();
    }
    tags.push({ icon: "review", label, tone: "warning" });
  }
  if (item.disputedCount > 0 && !item.oldestOverdue) {
    tags.push({
      icon: "overdue",
      label: m.contract_tag_disputed(),
      tone: "danger",
    });
  }
  if (item.next?.dueDate === today && !item.oldestOverdue) {
    tags.push({ icon: null, label: m.contract_tag_today(), tone: "ink" });
  }
  if (tags.length === 0) {
    tags.push({
      icon: "check",
      label: m.contracts_tag_on_track(),
      tone: "brand",
    });
  }
  return tags;
}

function footerOf(
  item: ContractListItem,
  today: string,
  locale: Locale
): string {
  if (item.settled) {
    return m.contracts_footer_ended({
      month: item.endDate ? monthYearShort(item.endDate, locale) : "",
    });
  }
  if (item.oldestOverdue) {
    return overdueFooter(item, today, locale);
  }
  const next = item.next;
  if (!next) {
    return "";
  }
  const date = sinceDate(next.dueDate, today, locale);
  if (next.status === "awaiting_confirmation" || next.status === "disputed") {
    return m.contracts_footer_on({ sequence: next.sequence, date });
  }
  if (next.dueDate === today) {
    return m.contracts_footer_number({
      sequence: next.sequence,
      count: item.installmentsCount,
    });
  }
  return next.sequence === item.installmentsCount
    ? m.contracts_footer_last({ date })
    : m.contracts_footer_next({ date });
}

/** What a contract card draws, ready to render (mockup 20, B4: no cells, the installment of the moment in the footer). */
export function contractCardView(
  item: ContractListItem,
  today: string,
  locale: Locale
): ContractCardView {
  return {
    footer: footerOf(item, today, locale),
    // 100 is only for a settled contract: 99,6% of a contract with an open installment is not done (D15).
    percent: item.settled ? 100 : Math.min(99, item.percent),
    percentLabel: percentLabel(item.direction),
    remaining: remainingOf(item),
    role: roleOf(item.direction),
    tags: tagsOf(item, today),
  };
}
