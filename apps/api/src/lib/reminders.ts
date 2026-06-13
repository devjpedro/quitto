import { NOTIFICATION_TYPE, REMINDER_WINDOW_DAYS } from "@quitto/shared";
import { addDays } from "./dates";

export interface ReminderInput {
  contractId: string;
  dueDate: string; // YYYY-MM-DD
  installmentId: string;
  payerUserId: string | null;
}

export interface ReminderNotification {
  contractId: string;
  dedupeKey: string;
  installmentId: string;
  type:
    | typeof NOTIFICATION_TYPE.installmentDueSoon
    | typeof NOTIFICATION_TYPE.installmentOverdue;
  userId: string;
}

/**
 * Pure: maps open installments to the reminder notifications to create today.
 * `due_soon` for [today, today+REMINDER_WINDOW_DAYS]; `overdue` for past due.
 * Installments without a linked payer are skipped (no one to notify).
 */
export function computeReminders(
  items: ReminderInput[],
  todayISO: string
): ReminderNotification[] {
  const windowEnd = addDays(todayISO, REMINDER_WINDOW_DAYS);
  const out: ReminderNotification[] = [];
  for (const it of items) {
    if (!it.payerUserId) {
      continue;
    }
    let type: ReminderNotification["type"] | null = null;
    if (it.dueDate < todayISO) {
      type = NOTIFICATION_TYPE.installmentOverdue;
    } else if (it.dueDate <= windowEnd) {
      type = NOTIFICATION_TYPE.installmentDueSoon;
    }
    if (!type) {
      continue;
    }
    out.push({
      userId: it.payerUserId,
      contractId: it.contractId,
      installmentId: it.installmentId,
      type,
      dedupeKey: `reminder:${type}:${it.installmentId}`,
    });
  }
  return out;
}
