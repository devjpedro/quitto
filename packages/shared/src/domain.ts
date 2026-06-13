// Single source of truth for domain value sets, shared by API and web.

export const INSTALLMENT_STATUS = {
  pending: "pending",
  awaitingConfirmation: "awaiting_confirmation",
  confirmed: "confirmed",
  disputed: "disputed",
  paid: "paid",
} as const;
export type InstallmentStatus =
  (typeof INSTALLMENT_STATUS)[keyof typeof INSTALLMENT_STATUS];
export const INSTALLMENT_STATUSES = Object.values(INSTALLMENT_STATUS) as [
  InstallmentStatus,
  ...InstallmentStatus[],
];

export const CONTRACT_STATUS = {
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
} as const;
export type ContractStatus =
  (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];
export const CONTRACT_STATUSES = Object.values(CONTRACT_STATUS) as [
  ContractStatus,
  ...ContractStatus[],
];

export const OWNER_ROLE = {
  buyer: "buyer",
  seller: "seller",
  neutral: "neutral",
} as const;
export type OwnerRole = (typeof OWNER_ROLE)[keyof typeof OWNER_ROLE];
export const OWNER_ROLES = Object.values(OWNER_ROLE) as [
  OwnerRole,
  ...OwnerRole[],
];

export const PARTICIPANT_ROLE = {
  owner: "owner",
  buyer: "buyer",
  seller: "seller",
  viewer: "viewer",
} as const;
export type ParticipantRole =
  (typeof PARTICIPANT_ROLE)[keyof typeof PARTICIPANT_ROLE];

export const AUDIT_TYPE = {
  proofSubmitted: "proof_submitted",
  paymentConfirmed: "payment_confirmed",
  paymentDisputed: "payment_disputed",
  installmentPaid: "installment_paid",
} as const;
export type AuditType = (typeof AUDIT_TYPE)[keyof typeof AUDIT_TYPE];

export const NOTIFICATION_TYPE = {
  proofSubmitted: "proof_submitted",
  paymentConfirmed: "payment_confirmed",
  paymentDisputed: "payment_disputed",
  installmentPaid: "installment_paid",
  installmentDueSoon: "installment_due_soon",
  installmentOverdue: "installment_overdue",
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
export const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE) as [
  NotificationType,
  ...NotificationType[],
];

/** Quantos dias antes do vencimento o lembrete "due_soon" dispara. */
export const REMINDER_WINDOW_DAYS = 3;

const PAID_STATUSES: ReadonlySet<string> = new Set([
  INSTALLMENT_STATUS.paid,
  INSTALLMENT_STATUS.confirmed,
]);

/** True when the installment counts as paid (paid or confirmed). */
export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status);
}

/**
 * Single definition of "overdue": past due, not paid, and not awaiting confirmation
 * (a submitted proof shouldn't read as overdue while it waits).
 */
export function isOverdue(
  dueDate: string,
  status: string,
  todayISO: string
): boolean {
  return (
    dueDate < todayISO &&
    !isPaidStatus(status) &&
    status !== INSTALLMENT_STATUS.awaitingConfirmation
  );
}
