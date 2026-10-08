import { z } from "zod";
import { isRealISODate } from "./date";

export type {
  ContractErrorCode,
  ContractRequest,
  ContractRequestInput,
  ContractWarningCode,
} from "./contract-create";
// biome-ignore lint/performance/noBarrelFile: index.ts is the package entry point; domain.ts is an internal module, not a true barrel
export {
  CONTRACT_ERROR_CODES,
  CONTRACT_WARNING_CODES,
  contractDescriptionSchema,
  contractOwnerRoleSchema,
  contractRequestSchema,
  contractTitleSchema,
  counterpartySchema,
  installmentRowsSchema,
  isContractErrorCode,
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

/** Builds and validates an env object from a Zod schema, failing fast. */
export function makeEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: unknown
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/** API error envelope shape (per spec: code + message + details). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

// ── Contracts ────────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")
  // A real day with a four-digit year: not 2027-02-31, not 0202-11-10.
  .refine(isRealISODate, "Data inválida (use AAAA-MM-DD)");

export const updateInstallmentSchema = z
  .object({
    amountCents: z.number().int().min(1, "Informe um valor").optional(),
    dueDate: isoDate.optional(),
  })
  .refine((v) => v.amountCents !== undefined || v.dueDate !== undefined, {
    message: "Altere ao menos um campo",
  });

export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;

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
