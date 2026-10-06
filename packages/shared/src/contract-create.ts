import { z } from "zod";
import { isRealISODate } from "./date";
import { OWNER_ROLE } from "./domain";
import { type ScheduleInput, scheduleCount, sumMismatch } from "./schedule";

/**
 * Every code the contract form and POST /api/contracts raise (mockup 15,
 * table T, plus two of planner's decision 5). A zod issue's message IS the
 * code; the web translates it, nothing in Portuguese leaves this package.
 */
export const CONTRACT_ERROR_CODES = [
  "contract.role.required",
  "contract.title.required",
  "contract.title.tooLong",
  "contract.description.tooLong",
  "schedule.mode.required",
  "schedule.total.required",
  "schedule.total.min",
  "schedule.total.tooSmall",
  "schedule.monthly.required",
  "schedule.count.range",
  "schedule.firstDue.required",
  "date.invalid",
  "installments.amount.min",
  "installments.sum.over",
  "installments.sum.under",
  "installments.count.mismatch",
  "counterparty.name.required",
  "counterparty.name.tooLong",
  "counterparty.email.invalid",
  "counterparty.email.self",
  "contract.create.failed",
] as const;
export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];

/** Warnings never block (owner's decision 8); the web raises them. */
export const CONTRACT_WARNING_CODES = [
  "schedule.firstDue.past",
  "installments.date.order",
] as const;
export type ContractWarningCode = (typeof CONTRACT_WARNING_CODES)[number];

const ERROR_CODES: ReadonlySet<string> = new Set(CONTRACT_ERROR_CODES);

export function isContractErrorCode(value: string): value is ContractErrorCode {
  return ERROR_CODES.has(value);
}

export const MAX_INSTALLMENTS = 600;
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const dueDate = z
  .string({ error: "schedule.firstDue.required" })
  .min(1, "schedule.firstDue.required")
  .regex(ISO_DATE, "date.invalid")
  .refine(isRealISODate, "date.invalid");

const installmentCount = z
  .number({ error: "schedule.count.range" })
  .int("schedule.count.range")
  .min(1, "schedule.count.range")
  .max(MAX_INSTALLMENTS, "schedule.count.range");

export const contractTitleSchema = z
  .string({ error: "contract.title.required" })
  .trim()
  .min(1, "contract.title.required")
  .max(200, "contract.title.tooLong");

export const contractDescriptionSchema = z
  .string()
  .max(2000, "contract.description.tooLong")
  .optional();

export const contractOwnerRoleSchema = z.enum(
  [OWNER_ROLE.buyer, OWNER_ROLE.seller],
  { error: "contract.role.required" }
);

export const splitScheduleSchema = z.object({
  mode: z.literal("split"),
  totalAmountCents: z
    .number({ error: "schedule.total.required" })
    .int("schedule.total.min")
    .min(1, "schedule.total.min"),
  installmentsCount: installmentCount,
  firstDueDate: dueDate,
});

export const monthlyScheduleSchema = z.object({
  mode: z.literal("monthly"),
  monthlyAmountCents: z
    .number({ error: "schedule.monthly.required" })
    .int("schedule.monthly.required")
    .min(1, "schedule.monthly.required"),
  months: installmentCount,
  firstDueDate: dueDate,
});

const installmentRowSchema = z.object({
  amountCents: z
    .number({ error: "installments.amount.min" })
    .int("installments.amount.min")
    .min(1, "installments.amount.min"),
  dueDate,
});

export const installmentRowsSchema = z
  .array(installmentRowSchema)
  .min(1, "schedule.count.range")
  .max(MAX_INSTALLMENTS, "schedule.count.range");

// Legacy bodies, accepted until phase 6 (spec §10): "auto" is the old name of
// split; "custom" carries its rows inside the schedule.
const autoScheduleSchema = splitScheduleSchema.extend({
  mode: z.literal("auto"),
});
const customScheduleSchema = z.object({
  mode: z.literal("custom"),
  installments: installmentRowsSchema,
});

export const counterpartySchema = z.object({
  name: z
    .string({ error: "counterparty.name.required" })
    .trim()
    .min(1, "counterparty.name.required")
    .max(120, "counterparty.name.tooLong"),
  // Blank means "no invite": only a non-blank value has to be an e-mail.
  email: z
    .string()
    .trim()
    .max(200, "counterparty.email.invalid")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "counterparty.email.invalid"
    )
    .optional(),
});

const scheduleSchema = z.discriminatedUnion(
  "mode",
  [
    splitScheduleSchema,
    monthlyScheduleSchema,
    autoScheduleSchema,
    customScheduleSchema,
  ],
  { error: "schedule.mode.required" }
);

/** The schedule a request describes, in the product's two modes; null for a legacy custom one. */
export function toScheduleInput(
  schedule: z.output<typeof scheduleSchema>
): ScheduleInput | null {
  if (schedule.mode === "custom") {
    return null;
  }
  if (schedule.mode === "auto") {
    return { ...schedule, mode: "split" };
  }
  return schedule;
}

export const contractRequestSchema = z
  .object({
    title: contractTitleSchema,
    description: contractDescriptionSchema,
    ownerRole: contractOwnerRoleSchema,
    // A missing boolean is a broken client, not a person's mistake.
    requiresConfirmation: z.boolean({ error: "contract.create.failed" }),
    schedule: scheduleSchema,
    installments: installmentRowsSchema.optional(),
    counterparty: counterpartySchema.optional(),
  })
  .superRefine((body, ctx) => {
    const schedule = toScheduleInput(body.schedule);
    if (schedule === null) {
      return;
    }
    if (
      schedule.mode === "split" &&
      schedule.totalAmountCents < schedule.installmentsCount
    ) {
      ctx.addIssue({
        code: "custom",
        message: "schedule.total.tooSmall",
        path: ["schedule", "totalAmountCents"],
        params: { count: schedule.installmentsCount },
      });
      return;
    }
    if (!body.installments) {
      return;
    }
    if (body.installments.length !== scheduleCount(schedule)) {
      ctx.addIssue({
        code: "custom",
        message: "installments.count.mismatch",
        path: ["installments"],
      });
      return;
    }
    const mismatch = sumMismatch(schedule, body.installments);
    if (mismatch) {
      ctx.addIssue({
        code: "custom",
        message:
          mismatch.direction === "over"
            ? "installments.sum.over"
            : "installments.sum.under",
        path: ["installments"],
        params: { diff: mismatch.diff },
      });
    }
  });

export type ContractRequestInput = z.input<typeof contractRequestSchema>;
export type ContractRequest = z.output<typeof contractRequestSchema>;

/** The other party's slot: the opposite of the owner's (planner's decision 7). */
export function oppositeRole(role: "buyer" | "seller"): "buyer" | "seller" {
  return role === "buyer" ? "seller" : "buyer";
}
