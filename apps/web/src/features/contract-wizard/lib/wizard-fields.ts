import type { WizardStep } from "./wizard-values";

/** A field on screen: what an issue points at and what "Continuar" focuses. */
export type WizardField =
  | "ownerRole"
  | "title"
  | "description"
  | "mode"
  | "totalCents"
  | "monthlyCents"
  | "count"
  | "firstDueDate"
  | "installments"
  | `installments.${number}.amountCents`
  | `installments.${number}.dueDate`
  | "party"
  | "counterpartyName"
  | "counterpartyEmail";

const ABOUT: ReadonlySet<WizardField> = new Set([
  "ownerRole",
  "title",
  "description",
]);
const PARTY: ReadonlySet<WizardField> = new Set([
  "party",
  "counterpartyName",
  "counterpartyEmail",
]);

export function stepOfField(field: WizardField): WizardStep {
  if (ABOUT.has(field)) {
    return 1;
  }
  return PARTY.has(field) ? 3 : 2;
}

const PATH_FIELD: Record<string, WizardField> = {
  title: "title",
  description: "description",
  ownerRole: "ownerRole",
  schedule: "mode",
  // zod 4 puts a missing mode on schedule.mode.
  "schedule.mode": "mode",
  "schedule.totalAmountCents": "totalCents",
  "schedule.monthlyAmountCents": "monthlyCents",
  "schedule.installmentsCount": "count",
  "schedule.months": "count",
  "schedule.firstDueDate": "firstDueDate",
  installments: "installments",
  "counterparty.name": "counterpartyName",
  "counterparty.email": "counterpartyEmail",
};

const ROW_PATH = /^installments[.]([0-9]+)[.](amountCents|dueDate)$/;

/** The API's details.path as the field on screen (a 422 goes back to its step). */
export function fieldOfPath(path: string | undefined): WizardField | null {
  if (!path) {
    return null;
  }
  const row = ROW_PATH.exec(path);
  if (row) {
    return row[2] === "amountCents"
      ? `installments.${Number(row[1])}.amountCents`
      : `installments.${Number(row[1])}.dueDate`;
  }
  return PATH_FIELD[path] ?? null;
}

/** The first field with an issue (they come in the order of the screen). */
export function firstField<T extends { field: WizardField }>(
  issues: readonly T[]
): WizardField | null {
  return issues[0]?.field ?? null;
}
