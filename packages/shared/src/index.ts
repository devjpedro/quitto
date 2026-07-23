import { z } from "zod";
import { OWNER_ROLE, PARTICIPANT_ROLE } from "./domain";
import { isValidPixKey } from "./pix";

// biome-ignore lint/performance/noBarrelFile: index.ts is the package entry point; domain.ts is an internal module, not a true barrel
export { APP_TIME_ZONE, isoDateInTimeZone, todayISO } from "./date";
export type {
  AuditType,
  ContractStatus,
  Direction,
  InstallmentStatus,
  NotificationType,
  OwnerRole,
  ParticipantRole,
} from "./domain";
export {
  AUDIT_TYPE,
  CONTRACT_STATUS,
  CONTRACT_STATUSES,
  DIRECTION,
  DIRECTIONS,
  INSTALLMENT_STATUS,
  INSTALLMENT_STATUSES,
  isOverdue,
  isPaidStatus,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
  OWNER_ROLE,
  OWNER_ROLES,
  PARTICIPANT_ROLE,
  REMINDER_WINDOW_DAYS,
} from "./domain";
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
  ScheduleRow,
} from "./schedule";
export {
  addMonths,
  generateMonthlySchedule,
  generateSchedule,
  splitAmount,
} from "./schedule";

/** Frase que o usuário digita para confirmar a exclusão da conta. */
export const DELETE_CONFIRM_PHRASE = "EXCLUIR";

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

/** Papéis que o dono pode ter ao criar um contrato (neutral fica fora do produto). */
export const CONTRACT_OWNER_ROLES = [
  OWNER_ROLE.buyer,
  OWNER_ROLE.seller,
] as const;
export const ownerRoleSchema = z.enum(CONTRACT_OWNER_ROLES);

const scheduleAutoSchema = z.object({
  mode: z.literal("auto"),
  totalAmountCents: z.number().int().min(1, "Informe um valor"),
  installmentsCount: z
    .number()
    .int()
    .min(1, "Mínimo 1 parcela")
    .max(600, "Máximo 600 parcelas"),
  firstDueDate: isoDate,
});

const scheduleCustomSchema = z.object({
  mode: z.literal("custom"),
  installments: z
    .array(
      z.object({
        amountCents: z.number().int().min(1, "Informe um valor"),
        dueDate: isoDate,
      })
    )
    .min(1, "Adicione ao menos uma parcela")
    .max(600, "Máximo 600 parcelas"),
});

const scheduleMonthlySchema = z.object({
  mode: z.literal("monthly"),
  monthlyAmountCents: z.number().int().min(1, "Informe um valor"),
  months: z.number().int().min(1, "Mínimo 1 mês").max(600, "Máximo 600 meses"),
  firstDueDate: isoDate,
});

export const createContractSchema = z.object({
  title: z.string().min(1, "Informe um título").max(200, "Título muito longo"),
  description: z.string().max(2000, "Descrição muito longa").optional(),
  ownerRole: ownerRoleSchema,
  requiresConfirmation: z.boolean(),
  schedule: z.discriminatedUnion("mode", [
    scheduleAutoSchema,
    scheduleCustomSchema,
    scheduleMonthlySchema,
  ]),
});

export const updateInstallmentSchema = z
  .object({
    amountCents: z.number().int().min(1, "Informe um valor").optional(),
    dueDate: isoDate.optional(),
  })
  .refine((v) => v.amountCents !== undefined || v.dueDate !== undefined, {
    message: "Altere ao menos um campo",
  });

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;

/** Chave PIX válida (formato). Normalização final acontece no servidor. */
export const pixKeySchema = z
  .string()
  .trim()
  .min(1, "Informe uma chave PIX")
  .refine(isValidPixKey, "Chave PIX inválida");

/** Body de atualização de chave: string válida OU vazio/null (limpa). */
export const pixKeyUpdateSchema = z.object({
  pixKey: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidPixKey(v), "Chave PIX inválida")
    .nullable(),
});
export type PixKeyUpdateInput = z.infer<typeof pixKeyUpdateSchema>;

// ── Participants & invites ───────────────────────────────────────────────────

/** Papéis que o dono pode atribuir a um participante (owner não é convidável). */
export const INVITABLE_PARTICIPANT_ROLES = [
  PARTICIPANT_ROLE.buyer,
  PARTICIPANT_ROLE.seller,
  PARTICIPANT_ROLE.viewer,
] as const;

export const addParticipantSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(120, "Máximo 120 caracteres"),
  role: z.enum(INVITABLE_PARTICIPANT_ROLES),
});
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "E-mail inválido")
    .max(200, "Máximo 200 caracteres")
    .email("E-mail inválido"),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/** Optional e-mail: blank passes; a non-blank value must be a valid e-mail. */
export const optionalEmail = z
  .string()
  .trim()
  .max(200, "Máximo 200 caracteres")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "E-mail inválido",
  })
  .optional();
