import type { Locale } from "@quitto/shared";
import { sequencesText } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { ContractInstallment } from "../types";
import { rowState } from "./status-counts";

export type ListRow =
  | { kind: "one"; installment: ContractInstallment }
  | {
      group: "paid" | "overdue" | "tail";
      installments: ContractInstallment[];
      kind: "group";
    };

/** Above this many installments, what comes after the next 3 open ones is one line. */
const TAIL_FROM = 24;
const TAIL_SHOWN = 3;

/**
 * The list's lines (DIRECAO › "Agrupe o que se repete"): the paid ones at the
 * start (2 or more), each run of overdue ones (2 or more) and, above 24
 * installments, what comes after the next 3 open ones. A settled contract is
 * a record: every installment on its own line.
 */
export function groupInstallmentRows(
  items: ContractInstallment[],
  today: string,
  settled: boolean
): ListRow[] {
  const sorted = [...items].sort((a, b) => a.sequence - b.sequence);
  if (settled) {
    return sorted.map((installment) => ({ kind: "one", installment }));
  }
  const rows: ListRow[] = [];
  let i = 0;
  let paidPrefix = 0;
  while (
    paidPrefix < sorted.length &&
    rowState(sorted[paidPrefix] as ContractInstallment, today) === "paid"
  ) {
    paidPrefix += 1;
  }
  if (paidPrefix >= 2) {
    rows.push({
      kind: "group",
      group: "paid",
      installments: sorted.slice(0, paidPrefix),
    });
    i = paidPrefix;
  }
  let openShown = 0;
  while (i < sorted.length) {
    const it = sorted[i] as ContractInstallment;
    const state = rowState(it, today);
    if (state === "overdue") {
      let j = i;
      while (
        j < sorted.length &&
        rowState(sorted[j] as ContractInstallment, today) === "overdue"
      ) {
        j += 1;
      }
      if (j - i >= 2) {
        rows.push({
          kind: "group",
          group: "overdue",
          installments: sorted.slice(i, j),
        });
        i = j;
        continue;
      }
    }
    if (state === "open" && sorted.length > TAIL_FROM) {
      if (openShown >= TAIL_SHOWN) {
        rows.push({
          kind: "group",
          group: "tail",
          installments: sorted.slice(i),
        });
        break;
      }
      openShown += 1;
    }
    rows.push({ kind: "one", installment: it });
    i += 1;
  }
  return rows;
}

/**
 * A group's title, its numbers in order: "Parcelas 1 e 2" for two in a row,
 * "Parcelas 5 a 28" for more. The card's overdue ones can have a gap (one in
 * review, or disputed, in between: review I3), said as the home says it:
 * "Parcelas 3 e 5 a 7", or "4 parcelas entre 3 e 9" past three pieces.
 */
export function groupTitle(
  items: { sequence: number }[],
  locale: Locale
): string {
  const first = items[0]?.sequence ?? 0;
  const last = items.at(-1)?.sequence ?? 0;
  if (last - first === items.length - 1) {
    return items.length === 2
      ? m.contract_group_pair({ first, last }, { locale })
      : m.contract_group_range({ first, last }, { locale });
  }
  const text = sequencesText(
    items.map((it) => it.sequence),
    locale
  );
  return text.kind === "list"
    ? m.contract_group_list({ list: text.text }, { locale })
    : m.contract_group_spread(
        { n: text.n, first: text.first, last: text.last },
        { locale }
      );
}
