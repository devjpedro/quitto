import { type Locale, NOTIFICATION_TYPE } from "@quitto/shared";
import { formatRelativeTime } from "@/lib/locale-format";
import { sequencesLabel } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { NotificationItem } from "../types";

export type NotificationTone = "brand" | "warning" | "danger" | "neutral";

/** A space a line never breaks at (no backslash escapes in this file). */
const NBSP = String.fromCharCode(0xa0);

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

/**
 * A grouped line's title (DIRECAO › "Agrupe o que se repete"): every group
 * says its count in words, so a screen reader hears it too (the tile with
 * the count is decorative).
 */
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
  [NOTIFICATION_TYPE.participantLeft]: m.notification_group_participant_left,
  [NOTIFICATION_TYPE.inviteAccepted]: m.notification_group_invite_accepted,
  [NOTIFICATION_TYPE.inviteDeclined]: m.notification_group_invite_declined,
};

/**
 * Where a line leads: a group opens its contract as it is (the contract's
 * list says the rest); one notice opens its installment.
 */
export function notificationTarget(item: NotificationItem): {
  installment?: string;
} {
  if (item.count > 1) {
    return {};
  }
  return item.installmentId ? { installment: item.installmentId } : {};
}

/**
 * The meta line's parts. The e-mail and the reason are one notice's: a group
 * would read as if all of it had them, so it shows neither.
 */
function metaParts(item: NotificationItem, locale: Locale): string[] {
  const parts = [item.contractTitle];
  if (item.sequences.length > 0) {
    parts.push(sequencesLabel(item.sequences, item.installmentsCount, locale));
  } else if (item.count === 1 && typeof item.metadata?.email === "string") {
    parts.push(item.metadata.email);
  }
  return parts;
}

/**
 * "A · B · C" that wraps only where it reads well: each "·" holds on to what
 * comes before it (never opens a line), and the relative time stays whole
 * ("há 3 dias"). The installment label holds in its messages ("parcela
 * 4 de 12", "5 a 28"), so the line breaks after a "·".
 */
function metaLine(parts: string[], when: string, locale: Locale): string {
  const [first = "", ...rest] = [...parts, when.replaceAll(" ", NBSP)];
  return rest.reduce(
    (line, part) =>
      `${line}${NBSP}${m.home_dot_after({ text: part }, { locale })}`,
    first
  );
}

/** What a notification row says. The text is built here, in the reader's language (§9). */
export function notificationView(
  item: NotificationItem,
  nowMs: number,
  locale: Locale
): NotificationView {
  const rawReason = item.metadata?.reason;
  const reason =
    item.count === 1 && typeof rawReason === "string" && rawReason.trim() !== ""
      ? m.notification_reason({ reason: rawReason }, { locale })
      : null;
  const title =
    item.count > 1
      ? (GROUP_TITLE[item.type] ?? m.notification_group_fallback)(
          { count: item.count },
          { locale }
        )
      : (TITLE[item.type] ?? m.notification_type_fallback)({}, { locale });
  return {
    title,
    tone: TONE[item.type] ?? "neutral",
    meta: metaLine(
      metaParts(item, locale),
      formatRelativeTime(item.createdAt, nowMs, locale),
      locale
    ),
    reason,
    unread: item.readAt === null,
    count: item.count,
  };
}
