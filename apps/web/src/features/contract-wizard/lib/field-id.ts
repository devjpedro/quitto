import type { WizardField } from "./wizard-fields";

/** The element of a field (the input, or the radiogroup): what "Continuar" focuses when it is wrong. */
export function fieldId(field: WizardField): string {
  return `wizard-${field.replaceAll(".", "-")}`;
}
