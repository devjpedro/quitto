import {
  INSTALLMENT_STATUS,
  isoDateInTimeZone,
  type Locale,
} from "@quitto/shared";
import type { BarStatus } from "@/components/ui/installment-bar";
import type { TagTone } from "@/components/ui/tag";
import { dayMonthLong } from "@/lib/date-parts";
import { daysBetween, formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { ContractInstallment } from "../types";
import type { Perspective } from "./contract-view";
import { barStatusOf, rowState } from "./status-counts";

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
/** "em N dias" only while it is near: past two months a row is its date and amount. */
const NEAR_DAYS = 62;
/** Past this, an overdue tag just says "Atrasada" (the group's "desde" says how long). */
const LATE_DAYS_SHOWN = 60;

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

/** "Parcelas 1 e 2" for two, "Parcelas 5 a 28" for more (the title of a group, and of the card's). */
export function groupTitle(
  items: { sequence: number }[],
  locale: Locale
): string {
  const first = items[0]?.sequence ?? 0;
  const last = items.at(-1)?.sequence ?? 0;
  return items.length === 2
    ? m.contract_group_pair({ first, last }, { locale })
    : m.contract_group_range({ first, last }, { locale });
}

export interface RowContext {
  locale: Locale;
  otherFirstName: string | null;
  perspective: Perspective;
  settled: boolean;
  today: string;
}

export interface RowView {
  meta: string | null;
  /** The row is paid: its amount in ink-muted. */
  muted: boolean;
  /** Settled rows carry no tag: their state goes to the accessible name. */
  srState: string | null;
  tag: {
    icon:
      | "check"
      | "seal"
      | "warning"
      | "magnifier"
      | "hourglass"
      | "file"
      | "x"
      | null;
    text: string;
    tone: TagTone;
  } | null;
  tile: BarStatus;
  title: string;
}

function receivedMeta(it: ContractInstallment, ctx: RowContext): string | null {
  if (!it.paidAt) {
    return null;
  }
  const day = isoDateInTimeZone(new Date(it.paidAt));
  if (day === it.dueDate) {
    return null;
  }
  const options = { locale: ctx.locale };
  const date = formatDate(day, ctx.locale, "dayMonth");
  const on =
    ctx.perspective === "receive"
      ? m.contract_row_received_on({ date }, options)
      : m.contract_row_paid_on({ date }, options);
  const late = daysBetween(it.dueDate, day);
  if (late <= 0) {
    return on;
  }
  const after =
    late === 1
      ? m.contract_row_day_late({}, options)
      : m.contract_row_days_late({ count: late }, options);
  return m.contract_join({ left: on, right: after }, options);
}

function overdueTag(it: ContractInstallment, ctx: RowContext): RowView["tag"] {
  const options = { locale: ctx.locale };
  const days = daysBetween(it.dueDate, ctx.today);
  let text = m.contract_tag_overdue({}, options);
  if (days === 1) {
    text = m.contract_tag_overdue_day({}, options);
  } else if (days <= LATE_DAYS_SHOWN) {
    text = m.contract_tag_overdue_days({ count: days }, options);
  }
  return { tone: "danger", icon: "warning", text };
}

function reviewTag(ctx: RowContext): RowView["tag"] {
  const options = { locale: ctx.locale };
  if (ctx.perspective === "receive") {
    return {
      tone: "warning",
      icon: "magnifier",
      text: m.contract_tag_review_receive({}, options),
    };
  }
  if (ctx.perspective === "pay") {
    return {
      tone: "warning",
      icon: "hourglass",
      text: m.contract_tag_review_pay(
        { name: ctx.otherFirstName ?? "" },
        options
      ),
    };
  }
  return {
    tone: "warning",
    icon: "file",
    text: m.contract_tag_review_view({}, options),
  };
}

function paidTag(it: ContractInstallment, ctx: RowContext): RowView["tag"] {
  const options = { locale: ctx.locale };
  if (it.status === INSTALLMENT_STATUS.confirmed) {
    return {
      tone: "brand",
      icon: "seal",
      text: m.contract_tag_confirmed({}, options),
    };
  }
  return {
    tone: "brand",
    icon: "check",
    text:
      ctx.perspective === "receive"
        ? m.contract_tag_received({}, options)
        : m.contract_tag_paid({}, options),
  };
}

function tagOf(it: ContractInstallment, ctx: RowContext): RowView["tag"] {
  const options = { locale: ctx.locale };
  switch (rowState(it, ctx.today)) {
    case "paid":
      return paidTag(it, ctx);
    case "overdue":
      return overdueTag(it, ctx);
    case "review":
      return reviewTag(ctx);
    case "today":
      return {
        tone: "ink",
        icon: null,
        text: m.contract_tag_today({}, options),
      };
    case "disputed":
      return {
        tone: "danger",
        icon: "x",
        text: m.contract_tag_disputed({}, options),
      };
    default:
      return null;
  }
}

function openMeta(it: ContractInstallment, ctx: RowContext): string | null {
  const options = { locale: ctx.locale };
  const days = daysBetween(ctx.today, it.dueDate);
  if (days === 1) {
    return m.contract_row_tomorrow({}, options);
  }
  return days <= NEAR_DAYS
    ? m.contract_row_in_days({ count: days }, options)
    : null;
}

/** One installment's line (ajuste 14 §2.2): a tag only where there is a state to read; the meta only says what nothing else says. */
export function rowView(it: ContractInstallment, ctx: RowContext): RowView {
  const state = rowState(it, ctx.today);
  const options = { locale: ctx.locale };
  let meta: string | null = null;
  if (ctx.settled) {
    meta = receivedMeta(it, ctx);
  } else if (state === "open") {
    meta = openMeta(it, ctx);
  }
  let srState: string | null = null;
  if (ctx.settled) {
    srState =
      ctx.perspective === "receive"
        ? m.contract_row_sr_received({}, options)
        : m.contract_row_sr_paid({}, options);
  }
  return {
    tile:
      state === "disputed"
        ? "overdue"
        : barStatusOf(state, it.dueDate, ctx.today),
    title: dayMonthLong(it.dueDate, ctx.locale, ctx.today),
    tag: ctx.settled ? null : tagOf(it, ctx),
    meta,
    srState,
    muted: state === "paid",
  };
}
