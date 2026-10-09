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
  "amount.tooHigh",
  "installments.sum.over",
  "installments.sum.under",
  "installments.count.mismatch",
  "installments.paid.invalid",
  "installments.paid.duplicate",
  "installments.paid.future",
  "counterparty.name.required",
  "counterparty.name.tooLong",
  "counterparty.email.invalid",
  "counterparty.email.self",
  "contract.create.failed",
] as const;
export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];

/** Warnings never block (owner's decision 8); the web raises them. */
export const CONTRACT_WARNING_CODES = ["installments.date.order"] as const;
export type ContractWarningCode = (typeof CONTRACT_WARNING_CODES)[number];

const ERROR_CODES: ReadonlySet<string> = new Set(CONTRACT_ERROR_CODES);

export function isContractErrorCode(value: string): value is ContractErrorCode {
  return ERROR_CODES.has(value);
}
