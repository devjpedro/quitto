import {
  INSTALLMENT_STATUS,
  isPaidStatus,
  NOTIFICATION_TYPE,
  REMINDER_WINDOW_DAYS,
} from "@quitto/shared";
import { addDays } from "./dates";

export interface ReminderInput {
  contractId: string;
  dueDate: string; // YYYY-MM-DD
  installmentId: string;
  payerUserId: string | null;
  /** Dono do contrato quando ele é o vendedor (lado "a receber"); senão null. */
  receiverUserId: string | null;
  status: string;
}

type ReminderType =
  | typeof NOTIFICATION_TYPE.installmentDueSoon
  | typeof NOTIFICATION_TYPE.installmentOverdue
  | typeof NOTIFICATION_TYPE.installmentDueSoonReceivable
  | typeof NOTIFICATION_TYPE.installmentOverdueReceivable;

export interface ReminderNotification {
  contractId: string;
  dedupeKey: string;
  installmentId: string;
  type: ReminderType;
  userId: string;
}

/**
 * Pure: maps open installments to the reminder notifications to create today.
 * `due_soon` for [today, today+REMINDER_WINDOW_DAYS]; `overdue` for past due.
 * Payer gets the "a pagar" framing; the seller-owner gets "a receber". When the
 * seller-owner is also the resolved payer (no linked buyer), only "a receber".
 */
export function computeReminders(
  items: ReminderInput[],
  todayISO: string
): ReminderNotification[] {
  const windowEnd = addDays(todayISO, REMINDER_WINDOW_DAYS);
  const out: ReminderNotification[] = [];
  const push = (it: ReminderInput, userId: string, type: ReminderType) =>
    out.push({
      userId,
      contractId: it.contractId,
      installmentId: it.installmentId,
      type,
      dedupeKey: `reminder:${type}:${it.installmentId}:${userId}`,
    });

  for (const it of items) {
    // Settled (paid/confirmed) or awaiting approval → nothing to act on.
    if (
      isPaidStatus(it.status) ||
      it.status === INSTALLMENT_STATUS.awaitingConfirmation
    ) {
      continue;
    }
    let overdue: boolean;
    if (it.dueDate < todayISO) {
      overdue = true;
    } else if (it.dueDate <= windowEnd) {
      overdue = false;
    } else {
      continue;
    }
    if (it.payerUserId && it.payerUserId !== it.receiverUserId) {
      push(
        it,
        it.payerUserId,
        overdue
          ? NOTIFICATION_TYPE.installmentOverdue
          : NOTIFICATION_TYPE.installmentDueSoon
      );
    }
    if (it.receiverUserId) {
      push(
        it,
        it.receiverUserId,
        overdue
          ? NOTIFICATION_TYPE.installmentOverdueReceivable
          : NOTIFICATION_TYPE.installmentDueSoonReceivable
      );
    }
  }
  return out;
}
