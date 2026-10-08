import { scheduleTotal } from "@quitto/shared";
import { DateField } from "@/components/ui/date-field";
import { Emphasis } from "@/components/ui/emphasis";
import { MoneyField } from "@/components/ui/money-field";
import { errorCodeText, warningCodeText } from "@/lib/error-codes";
import { formatMoney } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { editRow } from "../lib/adjust";
import { fieldId } from "../lib/field-id";
import type { WizardField } from "../lib/wizard-fields";
import { scheduleOf } from "../lib/wizard-values";
import { StepHeading } from "./step-heading";

const GRID =
  "grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2.5";

/**
 * "Ajustar uma a uma" (mockup 15, D5/D7): a sub-screen of step 2, the
 * preview still live beside it. One filled block with straight dividers;
 * the number in Geist Mono turns lime on a row the person changed. It
 * scrolls inside the column from md, its bottom edge fading.
 */
export function AdjustInstallments({ wizard }: { wizard: ContractWizard }) {
  const { locale, values } = wizard;
  const schedule = scheduleOf(values);
  const total = formatMoney(schedule ? scheduleTotal(schedule) : 0, locale);
  const rows = (values.installments ?? []).map((row, index) => ({
    ...row,
    index,
    sequence: index + 1,
  }));
  const errorOf = (field: WizardField) => {
    const issue = wizard.issueFor(field);
    return issue
      ? errorCodeText(issue.code, issue.params ?? {}, locale)
      : undefined;
  };
  const warningOf = (field: WizardField) => {
    const warning = wizard.warningFor(field);
    return warning ? warningCodeText(warning.code, locale) : undefined;
  };
  const change = (index: number, patch: Parameters<typeof editRow>[2]) =>
    wizard.setValue(
      "installments",
      editRow(values.installments ?? [], index, patch)
    );
  return (
    <>
      <StepHeading
        headingRef={wizard.stepHeadingRef}
        lead={
          <Emphasis strong={total} text={m.wizard_adjust_lead({ total })} />
        }
        title={m.wizard_adjust_link()}
      />
      <div className="mt-5 flex min-h-0 flex-col overflow-hidden rounded-card bg-surface-card md:flex-1">
        <div
          aria-hidden="true"
          className={cn(GRID, "h-[34px] px-3 pt-1 text-ink-muted text-xs")}
        >
          <span>{m.wizard_adjust_col_number()}</span>
          <span>{m.wizard_adjust_col_due()}</span>
          <span>{m.wizard_adjust_col_amount()}</span>
        </div>
        {/* md:pb-11: the last row scrolls up out of the 44 px fade, so the 12th reads whole. */}
        <ol className="min-h-0 divide-y divide-divider md:overflow-y-auto md:pb-11 md:[mask-image:linear-gradient(#000_calc(100%_-_44px),transparent)]">
          {rows.map((row) => (
            <li
              className={cn(GRID, "min-h-[54px] px-3 py-1.5")}
              key={row.sequence}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 items-center justify-center rounded-[8px] font-medium font-mono text-xs",
                  row.edited
                    ? "bg-highlight text-on-highlight"
                    : "bg-surface-inset text-ink-muted"
                )}
              >
                {row.sequence}
              </span>
              <DateField
                error={errorOf(`installments.${row.index}.dueDate`)}
                id={fieldId(`installments.${row.index}.dueDate`)}
                label={m.wizard_adjust_due_label({ sequence: row.sequence })}
                labelHidden
                onValueChange={(iso) => change(row.index, { dueDate: iso })}
                value={row.dueDate}
                warning={warningOf(`installments.${row.index}.dueDate`)}
              />
              <MoneyField
                error={errorOf(`installments.${row.index}.amountCents`)}
                id={fieldId(`installments.${row.index}.amountCents`)}
                label={m.wizard_adjust_amount_label({ sequence: row.sequence })}
                labelHidden
                locale={locale}
                onValueChange={(cents) =>
                  change(row.index, { amountCents: cents })
                }
                value={row.amountCents}
              />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
