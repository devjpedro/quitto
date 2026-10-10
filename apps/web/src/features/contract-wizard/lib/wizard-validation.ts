import {
  type ContractErrorCode,
  type ContractWarningCode,
  contractDescriptionSchema,
  contractOwnerRoleSchema,
  contractTitleSchema,
  counterpartySchema,
  isContractErrorCode,
  MAX_AMOUNT_CENTS,
  monthlyScheduleSchema,
  splitScheduleSchema,
} from "@quitto/shared";
import type { CodeParams } from "@/lib/error-codes";
import type { WizardField } from "./wizard-fields";
import {
  isWizardDate,
  scheduleOf,
  type WizardStep,
  type WizardValues,
} from "./wizard-values";

export interface FieldIssue {
  code: ContractErrorCode;
  field: WizardField;
  params?: CodeParams;
}

export interface FieldWarning {
  code: ContractWarningCode;
  field: WizardField;
}

interface ZodIssueLike {
  message: string;
  path: readonly PropertyKey[];
}

/** A zod message is a code (Task 1); a stray one is the generic failure. */
function asCode(issue: ZodIssueLike | undefined): ContractErrorCode {
  return issue && isContractErrorCode(issue.message)
    ? issue.message
    : "contract.create.failed";
}

/** One issue per field, the first zod gives (the order of the screen). */
function collect(
  issues: readonly ZodIssueLike[],
  fieldOf: (issue: ZodIssueLike) => WizardField | null
): FieldIssue[] {
  const out: FieldIssue[] = [];
  for (const issue of issues) {
    const field = fieldOf(issue);
    if (field && !out.some((each) => each.field === field)) {
      out.push({ field, code: asCode(issue) });
    }
  }
  return out;
}

function validateAbout(values: WizardValues): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (
    !contractOwnerRoleSchema.safeParse(values.ownerRole ?? undefined).success
  ) {
    issues.push({ field: "ownerRole", code: "contract.role.required" });
  }
  const title = contractTitleSchema.safeParse(values.title);
  if (!title.success) {
    issues.push({ field: "title", code: asCode(title.error.issues[0]) });
  }
  const description = contractDescriptionSchema.safeParse(values.description);
  if (!description.success) {
    issues.push({
      field: "description",
      code: asCode(description.error.issues[0]),
    });
  }
  return issues;
}

const SCHEDULE_FIELD: Record<string, WizardField> = {
  totalAmountCents: "totalCents",
  monthlyAmountCents: "monthlyCents",
  installmentsCount: "count",
  months: "count",
  firstDueDate: "firstDueDate",
};

/** The one-by-one list: each amount, then the sum, which only has to fit the largest amount (it never has to match the agreed total). */
export function validateAdjusted(values: WizardValues): FieldIssue[] {
  const schedule = scheduleOf(values);
  if (!(schedule && values.installments)) {
    return [];
  }
  const issues: FieldIssue[] = [];
  for (let index = 0; index < values.installments.length; index += 1) {
    const row = values.installments[index];
    const amount = row?.amountCents ?? null;
    if (amount === null || amount < 1) {
      issues.push({
        field: `installments.${index}.amountCents`,
        code: "installments.amount.min",
      });
    }
    if (!isWizardDate(row?.dueDate ?? "")) {
      issues.push({
        field: `installments.${index}.dueDate`,
        code: "date.invalid",
      });
    }
  }
  if (issues.length > 0) {
    return issues;
  }
  // No sum to match: the total is what the rows add up to (owner's decision, mockup 20 B7).
  const sum = values.installments.reduce(
    (acc, row) => acc + (row.amountCents ?? 0),
    0
  );
  if (sum > MAX_AMOUNT_CENTS) {
    issues.push({ field: "installments", code: "amount.tooHigh" });
  }
  return issues;
}

function validateSchedule(values: WizardValues): FieldIssue[] {
  if (values.mode === null) {
    return [{ field: "mode", code: "schedule.mode.required" }];
  }
  const result =
    values.mode === "split"
      ? splitScheduleSchema.safeParse({
          mode: "split",
          totalAmountCents: values.totalCents ?? undefined,
          installmentsCount: values.count ?? undefined,
          firstDueDate: values.firstDueDate,
        })
      : monthlyScheduleSchema.safeParse({
          mode: "monthly",
          monthlyAmountCents: values.monthlyCents ?? undefined,
          months: values.count ?? undefined,
          firstDueDate: values.firstDueDate,
        });
  if (!result.success) {
    return collect(
      result.error.issues,
      (issue) => SCHEDULE_FIELD[String(issue.path[0])] ?? null
    );
  }
  const count = values.count ?? 0;
  if (values.mode === "split" && (values.totalCents ?? 0) < count) {
    return [
      {
        field: "totalCents",
        code: "schedule.total.tooSmall",
        params: { count },
      },
    ];
  }
  return validateAdjusted(values);
}

function validateParty(
  values: WizardValues,
  context: { sessionEmail: string | null }
): FieldIssue[] {
  if (values.party !== "other") {
    return [];
  }
  const result = counterpartySchema.safeParse({
    name: values.counterpartyName,
    email: values.counterpartyEmail,
  });
  if (!result.success) {
    return collect(result.error.issues, (issue) =>
      issue.path[0] === "email" ? "counterpartyEmail" : "counterpartyName"
    );
  }
  const email = values.counterpartyEmail.trim().toLowerCase();
  if (email && email === context.sessionEmail?.trim().toLowerCase()) {
    return [{ field: "counterpartyEmail", code: "counterparty.email.self" }];
  }
  return [];
}

/** The step's errors, with the shared schema's codes (the server raises the same). Step 4 checks everything. */
export function validateStep(
  step: WizardStep,
  values: WizardValues,
  context: { sessionEmail: string | null }
): FieldIssue[] {
  if (step === 1) {
    return validateAbout(values);
  }
  if (step === 2) {
    return validateSchedule(values);
  }
  if (step === 3) {
    return validateParty(values, context);
  }
  return [
    ...validateAbout(values),
    ...validateSchedule(values),
    ...validateParty(values, context),
  ];
}

/** Warnings never block (owner's decision 8): an adjusted row due before the previous one. A past first due date asks "já foram pagas?" instead. */
export function scheduleWarnings(values: WizardValues): FieldWarning[] {
  const warnings: FieldWarning[] = [];
  const rows = values.installments ?? [];
  for (let index = 1; index < rows.length; index += 1) {
    const due = rows[index]?.dueDate ?? "";
    const before = rows[index - 1]?.dueDate ?? "";
    if (isWizardDate(due) && isWizardDate(before) && due < before) {
      warnings.push({
        field: `installments.${index}.dueDate`,
        code: "installments.date.order",
      });
    }
  }
  return warnings;
}
