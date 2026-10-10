import type { WizardField } from "./wizard-fields";
import type { WizardValues } from "./wizard-values";

/** The schedule fields: changing one drops the one-by-one list (planner's decision 24). */
const RESETS_ADJUSTED: ReadonlySet<keyof WizardValues> = new Set([
  "mode",
  "count",
  "totalCents",
  "monthlyCents",
  "firstDueDate",
]);

export function applyChange<K extends keyof WizardValues>(
  values: WizardValues,
  key: K,
  value: WizardValues[K]
): WizardValues {
  const next: WizardValues = { ...values, [key]: value };
  if (RESETS_ADJUSTED.has(key) && values[key] !== value) {
    next.installments = null;
    // The ticks were by sequence: another schedule is another list.
    next.paidSequences = [];
  }
  // Without another party there is no one to confirm (owner's decision 10).
  if (key === "party" && value !== "other") {
    next.requiresConfirmation = false;
  }
  return next;
}

/** Something the person typed or chose: a blur only checks those (or a field already wrong). */
export function filledField(values: WizardValues, field: WizardField): boolean {
  switch (field) {
    case "title":
    case "description":
    case "counterpartyName":
    case "counterpartyEmail":
      return values[field].trim().length > 0;
    case "firstDueDate":
      return values.firstDueDate !== "";
    case "ownerRole":
    case "mode":
    case "party":
    case "totalCents":
    case "monthlyCents":
    case "count":
      return values[field] !== null;
    default:
      return true;
  }
}
