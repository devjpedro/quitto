import { type Locale, NOTIFICATION_TYPE } from "@quitto/shared";
import type { InstallmentFilter } from "@/lib/installments-filter";
import { formatRelativeTime } from "@/lib/locale-format";
import { sequencesLabel } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { NotificationItem } from "../types";

export type NotificationTone = "brand" | "warning" | "danger" | "neutral";

export interface NotificationView {
  count: number;
  meta: string;
  reason: string | null;
  title: string;
  tone: NotificationTone;
  unread: boolean;
}

type Message = (
  inputs: Record<string, never>,
  options: { locale: Locale }
) => string;

const TITLE: Record<string, Message> = {
  [NOTIFICATION_TYPE.proofSubmitted]: m.notification_type_proof_submitted,
  [NOTIFICATION_TYPE.paymentConfirmed]: m.notification_type_payment_confirmed,
  [NOTIFICATION_TYPE.paymentDisputed]: m.notification_type_payment_disputed,
  [NOTIFICATION_TYPE.installmentPaid]: m.notification_type_installment_paid,
  [NOTIFICATION_TYPE.installmentDueSoon]:
    m.notification_type_installment_due_soon,
  [NOTIFICATION_TYPE.installmentOverdue]:
    m.notification_type_installment_overdue,
  [NOTIFICATION_TYPE.installmentDueSoonReceivable]:
    m.notification_type_installment_due_soon_receivable,
  [NOTIFICATION_TYPE.installmentOverdueReceivable]:
    m.notification_type_installment_overdue_receivable,
  [NOTIFICATION_TYPE.participantLeft]: m.notification_type_participant_left,
  [NOTIFICATION_TYPE.inviteAccepted]: m.notification_type_invite_accepted,
  [NOTIFICATION_TYPE.inviteDeclined]: m.notification_type_invite_declined,
};

const TONE: Record<string, NotificationTone> = {
  [NOTIFICATION_TYPE.proofSubmitted]: "warning",
  [NOTIFICATION_TYPE.paymentConfirmed]: "brand",
  [NOTIFICATION_TYPE.installmentPaid]: "brand",
  [NOTIFICATION_TYPE.inviteAccepted]: "brand",
  [NOTIFICATION_TYPE.paymentDisputed]: "danger",
  [NOTIFICATION_TYPE.installmentOverdue]: "danger",
  [NOTIFICATION_TYPE.installmentOverdueReceivable]: "danger",
};

type GroupMessage = (
  inputs: { count: number },
  options: { locale: Locale }
) => string;

/** A grouped line's title (DIRECAO › "Agrupe o que se repete"); other types keep the singular, the count goes on the tile. */
const GROUP_TITLE: Record<string, GroupMessage> = {
  [NOTIFICATION_TYPE.proofSubmitted]: m.notification_group_proof_submitted,
  [NOTIFICATION_TYPE.paymentConfirmed]: m.notification_group_payment_confirmed,
  [NOTIFICATION_TYPE.paymentDisputed]: m.notification_group_payment_disputed,
  [NOTIFICATION_TYPE.installmentPaid]: m.notification_group_installment_paid,
  [NOTIFICATION_TYPE.installmentDueSoon]:
    m.notification_group_installment_due_soon,
  [NOTIFICATION_TYPE.installmentOverdue]:
    m.notification_group_installment_overdue,
  [NOTIFICATION_TYPE.installmentDueSoonReceivable]:
    m.notification_group_installment_due_soon_receivable,
  [NOTIFICATION_TYPE.installmentOverdueReceivable]:
    m.notification_group_installment_overdue_receivable,
};

/** The contract filter a grouped line opens on: the list already cut to what the line counts. */
const GROUP_FILTER: Partial<Record<string, InstallmentFilter>> = {
  [NOTIFICATION_TYPE.installmentOverdue]: "overdue",
  [NOTIFICATION_TYPE.installmentOverdueReceivable]: "overdue",
  [NOTIFICATION_TYPE.installmentPaid]: "paid",
  [NOTIFICATION_TYPE.paymentConfirmed]: "paid",
  [NOTIFICATION_TYPE.installmentDueSoon]: "due",
  [NOTIFICATION_TYPE.installmentDueSoonReceivable]: "due",
};

/**
 * Where a line leads: a group opens its contract filtered by what it counts
 * ("Atrasadas", "Pagas", "A pagar"), or as it is when no filter cuts it
 * (proofs, disputes, invites); one notice opens its installment.
 */
export function notificationTarget(item: NotificationItem): {
  installment?: string;
  status?: InstallmentFilter;
} {
  if (item.count > 1) {
    const status = GROUP_FILTER[item.type];
    return status ? { status } : {};
  }
  return item.installmentId ? { installment: item.installmentId } : {};
}

function metaParts(item: NotificationItem, locale: Locale): string[] {
  const parts = [item.contractTitle];
  if (item.sequences.length > 0) {
    parts.push(sequencesLabel(item.sequences, item.installmentsCount, locale));
  } else if (typeof item.metadata?.email === "string") {
    parts.push(item.metadata.email);
  }
  return parts;
}

/** What a notification row says. The text is built here, in the reader's language (§9). */
export function notificationView(
  item: NotificationItem,
  nowMs: number,
  locale: Locale
): NotificationView {
  const rawReason = item.metadata?.reason;
  const reason =
    typeof rawReason === "string" && rawReason.trim() !== ""
      ? m.notification_reason({ reason: rawReason }, { locale })
      : null;
  const group = item.count > 1 ? GROUP_TITLE[item.type] : undefined;
  const title = group
    ? group({ count: item.count }, { locale })
    : (TITLE[item.type] ?? m.notification_type_fallback)({}, { locale });
  return {
    title,
    tone: TONE[item.type] ?? "neutral",
    meta: [
      ...metaParts(item, locale),
      formatRelativeTime(item.createdAt, nowMs, locale),
    ].join(" · "),
    reason,
    unread: item.readAt === null,
    count: item.count,
  };
}
