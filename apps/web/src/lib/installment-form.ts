import type { UpdateInstallmentInput } from "@quitto/shared";

/**
 * Builds a minimal PATCH body: only fields actually filled (so editing one
 * doesn't clear the other).
 */
export function buildInstallmentPatch(
  values: UpdateInstallmentInput
): UpdateInstallmentInput {
  const body: UpdateInstallmentInput = {};
  if (values.amountCents !== undefined && !Number.isNaN(values.amountCents)) {
    body.amountCents = values.amountCents;
  }
  if (values.dueDate) {
    body.dueDate = values.dueDate;
  }
  return body;
}
