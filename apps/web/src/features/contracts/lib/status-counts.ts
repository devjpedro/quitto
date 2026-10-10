import {
  APP_TIME_ZONE,
  INSTALLMENT_STATUS,
  isoDateInTimeZone,
  isPaidStatus,
  type Locale,
} from "@quitto/shared";
import type { BarStatus } from "@/components/ui/installment-bar";
import { monthYearShort } from "@/lib/date-parts";
import { formatDate } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { Perspective } from "./contract-view";

export type RowState =
  | "paid"
  | "review"
  | "disputed"
  | "today"
  | "overdue"
  | "open";

/** Above this, the bar draws zones, not one segment per installment (DIRECAO › Progresso). */
const SEGMENTS_MAX = 24;
const ORDER: BarStatus[] = ["paid", "overdue", "review", "today", "open"];

interface Dated {
  dueDate: string;
  status: string;
}

export function rowState(it: Dated, today: string): RowState {
  if (isPaidStatus(it.status)) {
    return "paid";
  }
  if (it.status === INSTALLMENT_STATUS.awaitingConfirmation) {
    return "review";
  }
  if (it.status === INSTALLMENT_STATUS.disputed) {
    return "disputed";
  }
  if (it.dueDate === today) {
    return "today";
  }
  return it.dueDate < today ? "overdue" : "open";
}

/** A disputed installment past due draws as overdue (as on the home's bar, F1.5 decision 21). */
export function barStatusOf(
  state: RowState,
  dueDate: string,
  today: string
): BarStatus {
  if (state === "disputed") {
    return dueDate < today ? "overdue" : "open";
  }
  return state;
}

export function barView(
  items: Dated[],
  today: string
): { overdueCount: number; paidCount: number; statuses: BarStatus[] | null } {
  const statuses = items.map((it) =>
    barStatusOf(rowState(it, today), it.dueDate, today)
  );
  return {
    statuses: items.length > SEGMENTS_MAX ? null : statuses,
    paidCount: statuses.filter((s) => s === "paid").length,
    overdueCount: statuses.filter((s) => s === "overdue").length,
  };
}

interface Options {
  locale: Locale;
}

/** Paid: "confirmadas" when confirmation is on; otherwise "recebidas" to whoever receives, "pagas" to the rest. */
function paidLabel(
  one: boolean,
  perspective: Perspective,
  requiresConfirmation: boolean,
  options: Options
): string {
  if (requiresConfirmation) {
    return one
      ? m.contract_key_confirmed_one({}, options)
      : m.contract_key_confirmed_other({}, options);
  }
  if (perspective === "receive") {
    return one
      ? m.contract_key_received_one({}, options)
      : m.contract_key_received_other({}, options);
  }
  return one
    ? m.contract_key_paid_one({}, options)
    : m.contract_key_paid_other({}, options);
}

/** A proof waiting: "para conferir" to whoever receives, "aguardando confirmação" to the payer. */
function reviewLabel(perspective: Perspective, options: Options): string {
  if (perspective === "receive") {
    return m.contract_key_review_receive({}, options);
  }
  return perspective === "pay"
    ? m.contract_key_review_pay({}, options)
    : m.contract_key_review_view({}, options);
}

/** Ahead: "a receber", "a pagar" or, to a viewer, "em aberto". */
function openLabel(perspective: Perspective, options: Options): string {
  if (perspective === "receive") {
    return m.contract_key_open_receive({}, options);
  }
  return perspective === "pay"
    ? m.contract_key_open_pay({}, options)
    : m.contract_key_open_view({}, options);
}

function label(
  status: BarStatus,
  count: number,
  perspective: Perspective,
  requiresConfirmation: boolean,
  locale: Locale
): string {
  const options = { locale };
  const one = pluralForm(count, locale) === "one";
  switch (status) {
    case "paid":
      return paidLabel(one, perspective, requiresConfirmation, options);
    case "overdue":
      return one
        ? m.contract_key_overdue_one({}, options)
        : m.contract_key_overdue_other({}, options);
    case "review":
      return reviewLabel(perspective, options);
    case "today":
      return m.contract_key_today({}, options);
    default:
      return openLabel(perspective, options);
  }
}

/** The bar's key: how many in each state, in the bar's order, each with its words (status never by color alone). */
export function legendEntries(
  items: Dated[],
  today: string,
  perspective: Perspective,
  requiresConfirmation: boolean,
  locale: Locale
): { count: number; label: string; status: BarStatus }[] {
  const all = items.map((it) =>
    barStatusOf(rowState(it, today), it.dueDate, today)
  );
  return ORDER.map((status) => ({
    status,
    count: all.filter((s) => s === status).length,
  }))
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      ...entry,
      label: label(
        entry.status,
        entry.count,
        perspective,
        requiresConfirmation,
        locale
      ),
    }));
}

/** The key's right end: when the contract ends, or the day it was settled. */
export function legendEnd(
  items: (Dated & { paidAt: string | null })[],
  locale: Locale
): string {
  const options = { locale };
  if (items.length > 0 && items.every((it) => isPaidStatus(it.status))) {
    const last = items
      .map((it) => it.paidAt)
      .filter((at): at is string => at !== null)
      .sort()
      .at(-1);
    const day = last
      ? isoDateInTimeZone(new Date(last), APP_TIME_ZONE)
      : (items.at(-1)?.dueDate ?? "");
    return m.contract_key_settled(
      { date: formatDate(day, locale, "short") },
      options
    );
  }
  const lastDue =
    items
      .map((it) => it.dueDate)
      .sort()
      .at(-1) ?? "";
  return m.contract_key_ends(
    { month: monthYearShort(lastDue, locale) },
    options
  );
}
