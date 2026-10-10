import { isPaidStatus, type Locale } from "@quitto/shared";
import { sinceDate } from "@/lib/date-parts";
import { m } from "@/paraglide/messages.js";
import type { ContractDetail, ContractInstallment } from "../types";
import {
  counterpartLine,
  isSettled,
  type Perspective,
  perspectiveOf,
} from "./contract-view";
import { groupTitle } from "./installment-rows";
import { rowState } from "./status-counts";

export type NextAction =
  | { kind: "settled" }
  | { kind: "overdue"; installments: ContractInstallment[] }
  | {
      kind: "today" | "review" | "disputed" | "next";
      installment: ContractInstallment;
    };

/** The card that asks for something (everything but "settled"). */
export type PendingAction = Exclude<NextAction, { kind: "settled" }>;

export type CardButton =
  | "whatsapp_charge"
  | "whatsapp_remind"
  | "mark_received"
  | "open_oldest"
  | "review"
  | "pay_pix"
  | "mark_paid"
  | "pay_oldest"
  | "resend"
  | "statement"
  | "receipts";

const bySequence = (a: ContractInstallment, b: ContractInstallment) =>
  a.sequence - b.sequence;

/**
 * What the green card asks for (DIRECAO › Contrato), in the home's order:
 * the overdue ones (one card, oldest first), what is due today, a proof to
 * review (the receiver's), a disputed one (the payer's), then the next one.
 * A viewer has no card; a settled contract has the lime milestone.
 */
export function nextActionOf(
  detail: Pick<ContractDetail, "role" | "installments">,
  today: string
): NextAction | null {
  const perspective = perspectiveOf(detail.role);
  if (perspective === "view") {
    return null;
  }
  const items = [...detail.installments].sort(bySequence);
  if (isSettled(items)) {
    return { kind: "settled" };
  }
  const states = items.map((it) => ({ it, state: rowState(it, today) }));
  // For whoever receives, a disputed installment past due is still money owed
  // (the home counts it as overdue, home.ts classify; the bar draws it so):
  // review M2. For the payer it is the "Contestada" card further down.
  const lateForReceiver = (s: { it: ContractInstallment; state: string }) =>
    perspective === "receive" && s.state === "disputed" && s.it.dueDate < today;
  const overdue = states
    .filter((s) => s.state === "overdue" || lateForReceiver(s))
    .map((s) => s.it);
  if (overdue.length > 0) {
    return { kind: "overdue", installments: overdue };
  }
  const first = (state: string) => states.find((s) => s.state === state)?.it;
  const dueToday = first("today");
  if (dueToday) {
    return { kind: "today", installment: dueToday };
  }
  const review = first("review");
  if (perspective === "receive" && review) {
    return { kind: "review", installment: review };
  }
  const disputed = first("disputed");
  if (perspective === "pay" && disputed) {
    return { kind: "disputed", installment: disputed };
  }
  const next = items.find(
    (it) => !isPaidStatus(it.status) && rowState(it, today) === "open"
  );
  return next ? { kind: "next", installment: next } : null;
}

/** The card's buttons, first one primary. No batch actions: a group opens its oldest (owner's decision 8). */
export function cardButtons(
  action: NextAction,
  perspective: Perspective,
  requiresConfirmation: boolean
): CardButton[] {
  if (action.kind === "settled") {
    return ["statement", "receipts"];
  }
  if (action.kind === "overdue" && action.installments.length > 1) {
    return perspective === "receive"
      ? ["whatsapp_charge", "open_oldest"]
      : ["pay_oldest"];
  }
  if (perspective === "receive") {
    if (action.kind === "review") {
      return ["review"];
    }
    return [
      action.kind === "overdue" ? "whatsapp_charge" : "whatsapp_remind",
      "mark_received",
    ];
  }
  if (action.kind === "disputed") {
    return ["resend"];
  }
  return requiresConfirmation ? ["pay_pix"] : ["pay_pix", "mark_paid"];
}

export interface NextActionView {
  amountCents: number;
  /** The installment a button opens or marks: the one, or the group's oldest. */
  installment: ContractInstallment;
  /** The other party's line; `name` goes in bold. Null without anyone on the other side. */
  person: { name: string; text: string } | null;
  tag: string;
  title: string;
}

function tagText(action: PendingAction, locale: Locale) {
  const options = { locale };
  switch (action.kind) {
    case "overdue":
      return action.installments.length > 1
        ? m.contract_next_overdue_other({}, options)
        : m.contract_next_overdue_one({}, options);
    case "today":
      return m.contract_next_today({}, options);
    case "review":
      return m.contract_next_review({}, options);
    case "disputed":
      return m.contract_next_disputed({}, options);
    default:
      return m.contract_next_upcoming({}, options);
  }
}

/**
 * The receiver's line under the amount. Said once per screen (decision 11,
 * review I4): the "when" is the tag's ("vence hoje") or the list's (the
 * line's date), so "vence hoje" reads "te deve" and "Próxima" just "de Ana
 * Rocha", the mirror of the payer's "para Carlos Lima".
 */
function personText(
  action: PendingAction,
  name: string,
  today: string,
  locale: Locale
): string {
  const options = { locale };
  if (action.kind === "overdue") {
    const [oldest] = action.installments;
    return action.installments.length > 1 && oldest
      ? m.contract_who_owes_since(
          { name, date: sinceDate(oldest.dueDate, today, locale) },
          options
        )
      : m.contract_who_owes({ name }, options);
  }
  if (action.kind === "review") {
    return m.contract_who_sent_proof({ name }, options);
  }
  if (action.kind === "next") {
    return m.contract_who_from({ name }, options);
  }
  return m.contract_who_owes({ name }, options);
}

/**
 * What the green card says (DIRECAO › Contrato, enxuto): the reason in the
 * tag (no days), "Parcela 3" (no "de 10", no date), the amount (a group's
 * sum) and the other party; the "desde" only on a group.
 */
export function nextActionView(
  action: PendingAction,
  detail: Pick<ContractDetail, "role" | "participants">,
  today: string,
  locale: Locale
): NextActionView {
  const items =
    action.kind === "overdue" ? action.installments : [action.installment];
  const [first] = items as [ContractInstallment];
  const line = counterpartLine(detail.participants, perspectiveOf(detail.role));
  let person: NextActionView["person"] = null;
  if (line.kind === "pay") {
    person = {
      name: line.name,
      text: m.contract_who_to({ name: line.name }, { locale }),
    };
  } else if (line.kind === "receive") {
    person = {
      name: line.name,
      text: personText(action, line.name, today, locale),
    };
  }
  return {
    tag: tagText(action, locale),
    title:
      items.length > 1
        ? groupTitle(items, locale)
        : m.contract_installment_title(
            { sequence: first.sequence },
            { locale }
          ),
    amountCents: items.reduce((sum, it) => sum + it.amountCents, 0),
    installment: first,
    person,
  };
}
