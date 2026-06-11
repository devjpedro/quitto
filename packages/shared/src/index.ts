import { z } from "zod";

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

export const ownerRoleSchema = z.enum(["buyer", "seller", "neutral"]);

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
export type OwnerRole = z.infer<typeof ownerRoleSchema>;
