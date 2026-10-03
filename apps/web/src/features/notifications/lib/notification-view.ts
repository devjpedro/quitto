import { type Locale, NOTIFICATION_TYPE } from "@quitto/shared";
import { formatRelativeTime } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { NotificationItem } from "../types";

export type NotificationTone = "brand" | "warning" | "danger" | "neutral";

export interface NotificationView {
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

function metaParts(item: NotificationItem, locale: Locale): string[] {
  const parts = [item.contractTitle];
  if (item.installmentSequence !== null) {
    parts.push(
      m.notification_installment(
        { sequence: item.installmentSequence, count: item.installmentsCount },
        { locale }
      )
    );
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
  return {
    title: (TITLE[item.type] ?? m.notification_type_fallback)({}, { locale }),
    tone: TONE[item.type] ?? "neutral",
    meta: [
      ...metaParts(item, locale),
      formatRelativeTime(item.createdAt, nowMs, locale),
    ].join(" · "),
    reason,
    unread: item.readAt === null,
  };
}
