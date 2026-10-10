import {
  APP_TIME_ZONE,
  INSTALLMENT_STATUS,
  isoDateInTimeZone,
  type Locale,
} from "@quitto/shared";
import type { Perspective } from "@/features/contracts/lib/contract-view";
import { daysBetween, formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";

export interface TrailInput {
  approverName: string | null;
  confirmedAt: string | null;
  dueDate: string;
  events: {
    actorName: string | null;
    createdAt: string;
    isMe: boolean;
    type: string;
  }[];
  /** The viewer confirms: the receiver, or the owner who pays a contact with no account (the capability, not the perspective). */
  isApprover: boolean;
  locale: Locale;
  paidAt: string | null;
  payerName: string | null;
  perspective: Perspective;
  proofs: { createdAt: string; state: string }[];
  /** Declared paid when the contract was created: nobody sent a proof or confirmed it, so two steps. */
  registeredOnCreate?: boolean;
  requiresConfirmation: boolean;
  status: string;
  today: string;
  /** A proof is on its way (P7): "Paga" waits for it to finish, not for the person to send it. */
  uploading?: boolean;
}

export interface TrailStep {
  key: "due" | "proof" | "done";
  name: string;
  state: "done" | "current" | "todo" | "bad";
  sub: string;
  tone: "brand" | "warning" | "danger";
}

const first = (name: string | null) => (name ?? "").split(" ")[0] ?? "";
const dayOf = (iso: string) => isoDateInTimeZone(new Date(iso), APP_TIME_ZONE);

function dueSub(dueDate: string, today: string, locale: Locale): string {
  const options = { locale };
  const date = formatDate(dueDate, locale, "dayMonth");
  if (dueDate === today) {
    return m.panel_sub_due_today({}, options);
  }
  return dueDate < today
    ? m.panel_sub_due_past({ date }, options)
    : m.panel_sub_due_future({ date }, options);
}

const timeFormatters = new Map<Locale, Intl.DateTimeFormat>();
function timeOf(iso: string, locale: Locale): string {
  let formatter = timeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    });
    timeFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso));
}

/** "hoje", "ontem" or "04/10": the day of an instant, as the panel says it. */
export function dayLabel(iso: string, today: string, locale: Locale): string {
  const options = { locale };
  const day = dayOf(iso);
  const ago = daysBetween(day, today);
  if (ago === 0) {
    return m.panel_today({}, options);
  }
  if (ago === 1) {
    return m.panel_yesterday({}, options);
  }
  return formatDate(day, locale, "dayMonth");
}

/** "10:00": the time of an instant, in the app's time zone. */
export function timeLabel(iso: string, locale: Locale): string {
  return timeOf(iso, locale);
}

/** "ontem, 10:00", "hoje, 14:02", "04/10, 10:00": when the proof came. */
export function momentOf(iso: string, today: string, locale: Locale): string {
  return m.panel_sub_at(
    { day: dayLabel(iso, today, locale), time: timeOf(iso, locale) },
    { locale }
  );
}

const SETTLING: ReadonlySet<string> = new Set([
  "payment_confirmed",
  "installment_received",
  "installment_paid",
]);

function settledSub(input: TrailInput): string {
  const options = { locale: input.locale };
  const at = input.confirmedAt ?? input.paidAt;
  const date = at ? formatDate(dayOf(at), input.locale, "dayMonth") : "";
  const last = input.events.find((e) => SETTLING.has(e.type));
  if (!last) {
    return date;
  }
  if (last.isMe) {
    return last.type === "payment_confirmed"
      ? m.panel_sub_by_you({ date }, options)
      : m.panel_sub_marked_by_you({ date }, options);
  }
  return m.panel_sub_by({ date, name: first(last.actorName) }, options);
}

function proofStep(input: TrailInput, paid: boolean): TrailStep {
  const { locale, status, today } = input;
  const options = { locale };
  const latestProof = [...input.proofs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )[0];
  const proof: TrailStep = {
    key: "proof",
    name: m.panel_step_proof({}, options),
    state: "todo",
    tone: "brand",
    sub:
      input.perspective === "pay"
        ? m.panel_sub_you_send({}, options)
        : m.panel_sub_they_send({ name: first(input.payerName) }, options),
  };
  if (status === INSTALLMENT_STATUS.awaitingConfirmation && latestProof) {
    return {
      ...proof,
      state: "current",
      tone: "warning",
      sub: momentOf(latestProof.createdAt, today, locale),
    };
  }
  if (status === INSTALLMENT_STATUS.disputed) {
    return {
      ...proof,
      state: "bad",
      tone: "danger",
      sub: m.panel_sub_disputed({}, options),
    };
  }
  if (paid) {
    return {
      ...proof,
      state: "done",
      sub: latestProof
        ? formatDate(dayOf(latestProof.createdAt), locale, "dayMonth")
        : "",
    };
  }
  return proof;
}

function confirmedSub(input: TrailInput, paid: boolean): string {
  const options = { locale: input.locale };
  // "You confirm" follows who holds the button, not who receives.
  const mine = input.perspective === "receive" || input.isApprover;
  if (paid) {
    return settledSub(input);
  }
  if (input.status === INSTALLMENT_STATUS.awaitingConfirmation && mine) {
    return m.panel_sub_missing_you({}, options);
  }
  return mine
    ? m.panel_sub_you_confirm({}, options)
    : m.panel_sub_they_confirm({ name: first(input.approverName) }, options);
}

function paidSub(input: TrailInput, paid: boolean): string {
  const options = { locale: input.locale };
  if (paid) {
    return settledSub(input);
  }
  if (input.perspective === "pay" && input.uploading) {
    return m.panel_sub_when_done({}, options);
  }
  return input.perspective === "pay"
    ? m.panel_sub_when_you_send({}, options)
    : m.panel_sub_when_they_pay({ name: first(input.payerName) }, options);
}

/**
 * The panel's status trail (DIRECAO › Contrato: the value and the trail, no
 * tag and no long date): with confirmation "A pagar → Comprovante →
 * Confirmada", without "A pagar → Paga". Each step says its date or who acts.
 */
export function trailSteps(input: TrailInput): TrailStep[] {
  const { locale, perspective, requiresConfirmation, status, today } = input;
  const options = { locale };
  const receive = perspective === "receive";
  const paid =
    status === INSTALLMENT_STATUS.paid ||
    status === INSTALLMENT_STATUS.confirmed;
  const pending = status === INSTALLMENT_STATUS.pending;
  const overdue = pending && input.dueDate < today;
  const due: TrailStep = {
    key: "due",
    name: receive
      ? m.panel_step_to_receive({}, options)
      : m.panel_step_to_pay({}, options),
    state: pending ? "current" : "done",
    tone: overdue ? "danger" : "brand",
    sub: dueSub(input.dueDate, today, locale),
  };
  if (!requiresConfirmation || input.registeredOnCreate) {
    return [
      due,
      {
        key: "done",
        name: receive
          ? m.panel_step_received({}, options)
          : m.panel_step_paid({}, options),
        state: paid ? "done" : "todo",
        tone: "brand",
        sub: paidSub(input, paid),
      },
    ];
  }
  return [
    due,
    proofStep(input, paid),
    {
      key: "done",
      name: m.panel_step_confirmed({}, options),
      state: paid ? "done" : "todo",
      tone: "brand",
      sub: confirmedSub(input, paid),
    },
  ];
}
