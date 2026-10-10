export type {
  ContractErrorCode,
  ContractWarningCode,
} from "./contract-codes";
// biome-ignore lint/performance/noBarrelFile: index.ts is the package entry point; domain.ts is an internal module, not a true barrel
export {
  CONTRACT_ERROR_CODES,
  CONTRACT_WARNING_CODES,
  isContractErrorCode,
} from "./contract-codes";
export type {
  ContractRequest,
  ContractRequestInput,
} from "./contract-create";
export {
  contractDescriptionSchema,
  contractOwnerRoleSchema,
  contractRequestSchema,
  contractTitleSchema,
  counterpartySchema,
  installmentRowsSchema,
  MAX_AMOUNT_CENTS,
  MAX_INSTALLMENTS,
  monthlyScheduleSchema,
  oppositeRole,
  splitScheduleSchema,
  toScheduleInput,
} from "./contract-create";
export {
  APP_TIME_ZONE,
  isoDateInTimeZone,
  isRealISODate,
  todayISO,
} from "./date";
export type {
  AuditType,
  ContractStatus,
  Direction,
  InstallmentStatus,
  Locale,
  NotificationType,
  OwnerRole,
  ParticipantRole,
} from "./domain";
export {
  AUDIT_TYPE,
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  DEFAULT_LOCALE,
  DIRECTION,
  DIRECTIONS,
  INSTALLMENT_STATUS,
  INSTALLMENT_STATUSES,
  isLocale,
  isOverdue,
  isPaidStatus,
  LOCALES,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
  OVERDUE_LOOKBACK_DAYS,
  OWNER_ROLE,
  OWNER_ROLES,
  PARTICIPANT_ROLE,
  REMINDER_WINDOW_DAYS,
} from "./domain";
export { normalizeName } from "./name";
export type { PixKeyType } from "./pix";
export {
  buildPixBrCode,
  isValidPixKey,
  normalizeMerchantName,
  parsePixKey,
} from "./pix";
export type {
  GenerateMonthlyScheduleInput,
  GenerateScheduleInput,
  ScheduleInput,
  ScheduleRow,
  SumMismatch,
} from "./schedule";
export {
  addMonths,
  buildSchedule,
  generateMonthlySchedule,
  generateSchedule,
  scheduleCount,
  scheduleTotal,
  splitAmount,
  spreadDifference,
  sumMismatch,
} from "./schedule";
export {
  makeEnv,
  type UpdateInstallmentInput,
  updateInstallmentSchema,
} from "./schemas";

/** API error envelope shape (per spec: code + message + details). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

// ── Receipts ─────────────────────────────────────────────────────────────────

/** Recibo exposto na página pública (ADR-0006): lista FECHADA de campos. */
export interface PublicReceipt {
  amountCents: number;
  contractTitle: string;
  installmentsCount: number;
  paidAt: string;
  payerName: string | null;
  receiverName: string | null;
  sequence: number;
}
