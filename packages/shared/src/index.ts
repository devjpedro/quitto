import { z } from "zod";
import { OWNER_ROLE, PARTICIPANT_ROLE } from "./domain";

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

export const createContractSchema = z.object({
  title: z.string().min(1, "Informe um título").max(200, "Título muito longo"),
  description: z.string().max(2000, "Descrição muito longa").optional(),
  ownerRole: ownerRoleSchema,
  requiresConfirmation: z.boolean(),
  schedule: z.discriminatedUnion("mode", [
    scheduleAutoSchema,
    scheduleCustomSchema,
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
