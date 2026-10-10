import {
  buildSchedule,
  type ContractRequestInput,
  isRealISODate,
  MAX_INSTALLMENTS,
  type ScheduleInput,
  type ScheduleRow,
} from "@quitto/shared";

export type WizardStep = 1 | 2 | 3 | 4;
export const WIZARD_STEPS: readonly WizardStep[] = [1, 2, 3, 4];

export interface WizardInstallment {
  amountCents: number | null;
  dueDate: string;
  /** The person changed this row (the lime tile and the "ajustada" tag). */
  edited: boolean;
}

/** What the form holds. Amounts in cents, dates as YYYY-MM-DD ("" while empty). */
export interface WizardValues {
  /** Installments (split) or months (monthly). */
  count: number | null;
  counterpartyEmail: string;
  counterpartyName: string;
  description: string;
  firstDueDate: string;
  /** "Ajustar uma a uma": null until the person opens and changes the list. */
  installments: WizardInstallment[] | null;
  mode: "split" | "monthly" | null;
  monthlyCents: number | null;
  ownerRole: "buyer" | "seller" | null;
  /** "As parcelas antes de hoje já foram pagas?": every one, none, or the ones in `paidSequences`. */
  paid: "all" | "none" | "some";
  /** With `paid: "some"`: the sequences (1-based) ticked as paid. */
  paidSequences: number[];
  party: "solo" | "other" | null;
  requiresConfirmation: boolean;
  title: string;
  totalCents: number | null;
}

export function emptyValues(title = ""): WizardValues {
  return {
    count: null,
    counterpartyEmail: "",
    counterpartyName: "",
    description: "",
    firstDueDate: "",
    installments: null,
    mode: null,
    monthlyCents: null,
    ownerRole: null,
    paid: "all",
    paidSequences: [],
    party: null,
    requiresConfirmation: false,
    title,
    totalCents: null,
  };
}

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** A row's date as the native input hands it: "" while a segment is cleared. */
export function isWizardDate(iso: string): boolean {
  return ISO_DATE.test(iso) && isRealISODate(iso);
}

/** The schedule once step 2 is complete enough to compute one; null before. */
export function scheduleOf(values: WizardValues): ScheduleInput | null {
  const { count, firstDueDate, mode } = values;
  if (
    mode === null ||
    count === null ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_INSTALLMENTS ||
    !isWizardDate(firstDueDate)
  ) {
    return null;
  }
  if (mode === "split") {
    const total = values.totalCents;
    // Below one cent per installment there is nothing honest to show.
    if (total === null || total < count) {
      return null;
    }
    return {
      mode,
      totalAmountCents: total,
      installmentsCount: count,
      firstDueDate,
    };
  }
  const monthly = values.monthlyCents;
  if (monthly === null || monthly < 1) {
    return null;
  }
  return { mode, monthlyAmountCents: monthly, months: count, firstDueDate };
}

/** The installments the contract will have: the adjusted list when there is one (an empty amount counts as zero). */
export function rowsOf(values: WizardValues): ScheduleRow[] {
  const schedule = scheduleOf(values);
  if (!schedule) {
    return [];
  }
  if (!values.installments) {
    return buildSchedule(schedule);
  }
  const generated = buildSchedule(schedule);
  return buildSchedule(
    schedule,
    values.installments.map((row, index) => ({
      amountCents: row.amountCents ?? 0,
      // A row whose date is mid-edit keeps the generated date in the preview:
      // the card never formats an empty date.
      dueDate: isWizardDate(row.dueDate)
        ? row.dueDate
        : (generated[index]?.dueDate ?? schedule.firstDueDate),
    }))
  );
}

/** The installments due before today: the ones the paid question is about (empty when none is). */
export function pastRows(values: WizardValues, today: string): ScheduleRow[] {
  return rowsOf(values).filter((row) => row.dueDate < today);
}

/** The sequences that enter the contract already paid, by the person's answer. */
export function paidSequencesOf(values: WizardValues, today: string): number[] {
  const past = pastRows(values, today).map((row) => row.sequence);
  if (values.paid === "none") {
    return [];
  }
  if (values.paid === "all") {
    return past;
  }
  return past.filter((sequence) => values.paidSequences.includes(sequence));
}

/**
 * The schedule the API checks the list against. Adjusted one by one, the total
 * is what the rows add up to (mockup 20, B7), so it goes as a split of that
 * sum: a monthly amount no longer describes the contract.
 */
function scheduleRequest(
  values: WizardValues
): ContractRequestInput["schedule"] {
  const adjusted = values.installments;
  if (adjusted) {
    return {
      mode: "split",
      totalAmountCents: adjusted.reduce(
        (sum, row) => sum + (row.amountCents ?? 0),
        0
      ),
      installmentsCount: adjusted.length,
      firstDueDate: values.firstDueDate,
    };
  }
  return values.mode === "monthly"
    ? {
        mode: "monthly",
        monthlyAmountCents: values.monthlyCents ?? 0,
        months: values.count ?? 0,
        firstDueDate: values.firstDueDate,
      }
    : {
        mode: "split",
        totalAmountCents: values.totalCents ?? 0,
        installmentsCount: values.count ?? 0,
        firstDueDate: values.firstDueDate,
      };
}

/** The POST /api/contracts body; null while there is no side (step 1 not done). */
export function toRequest(
  values: WizardValues,
  today: string
): ContractRequestInput | null {
  if (values.ownerRole === null) {
    return null;
  }
  const description = values.description.trim();
  const email = values.counterpartyEmail.trim();
  const withParty = values.party === "other";
  const paid = paidSequencesOf(values, today);
  return {
    title: values.title,
    ...(description ? { description } : {}),
    ownerRole: values.ownerRole,
    requiresConfirmation: withParty && values.requiresConfirmation,
    schedule: scheduleRequest(values),
    ...(values.installments
      ? {
          installments: values.installments.map((row) => ({
            amountCents: row.amountCents ?? 0,
            dueDate: row.dueDate,
          })),
        }
      : {}),
    ...(paid.length > 0 ? { paidInstallments: paid } : {}),
    ...(withParty
      ? {
          counterparty: {
            name: values.counterpartyName,
            ...(email ? { email } : {}),
          },
        }
      : {}),
  };
}
