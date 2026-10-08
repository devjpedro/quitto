import { ArrowsClockwise, CaretRight, Divide } from "@phosphor-icons/react";
import { DateField } from "@/components/ui/date-field";
import { FieldNote, TextField } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { OptionCard, OptionGroup } from "@/components/ui/option-card";
import { ResponsiveText } from "@/components/ui/responsive-text";
import { Tag } from "@/components/ui/tag";
import { weekdayLong } from "@/lib/date-parts";
import { errorCodeText, warningCodeText } from "@/lib/error-codes";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { fieldId } from "../lib/field-id";
import type { WizardField } from "../lib/wizard-fields";
import type { WizardValues } from "../lib/wizard-values";
import { StepHeading } from "./step-heading";

const LINK =
  "rounded-[4px] font-medium text-ink underline decoration-line-strong underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const NOT_DIGIT = /[^0-9]/g;
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function parseCount(text: string): number | null {
  const digits = text.replace(NOT_DIGIT, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

/** Whether the person changed a row of "uma a uma" and what the rows add up to: that sum is the total (mockup 20, B7). */
function adjustedTotal(values: WizardValues): number | null {
  const rows = values.installments;
  if (!rows?.some((row) => row.edited)) {
    return null;
  }
  return rows.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
}

/** The amount: the total (or the monthly), or, adjusted one by one, the sum of the rows, shown and no longer typed. */
function AmountField({ wizard }: { wizard: ContractWizard }) {
  const { locale, values } = wizard;
  const monthly = values.mode === "monthly";
  const amountField = monthly ? "monthlyCents" : "totalCents";
  const sum = adjustedTotal(values);
  const issue = wizard.issueFor(amountField);
  const typed = monthly ? values.monthlyCents : values.totalCents;
  return (
    <MoneyField
      error={
        issue
          ? errorCodeText(issue.code, issue.params ?? {}, locale)
          : undefined
      }
      id={fieldId(amountField)}
      label={
        monthly && sum === null
          ? m.wizard_monthly_label()
          : m.wizard_total_label()
      }
      labelAside={
        sum === null ? undefined : (
          <Tag tone="highlight">{m.wizard_adjusted_tag()}</Tag>
        )
      }
      locale={locale}
      onBlur={() => wizard.blur(amountField)}
      onValueChange={(cents) => wizard.setValue(amountField, cents)}
      readOnly={sum !== null}
      tall
      value={sum ?? typed}
    />
  );
}

/** "Valores ou datas diferentes por parcela? Ajustar uma a uma", or, once adjusted, the way back. */
function AdjustPrompt({ wizard }: { wizard: ContractWizard }) {
  const count = wizard.values.installments?.length ?? 0;
  const adjusted = adjustedTotal(wizard.values) !== null;
  return (
    <p className="mt-1.5 flex min-h-11 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] text-ink-muted leading-[1.4] md:mt-4 md:min-h-0">
      {adjusted ? (
        <>
          <span>
            {count === 1
              ? m.wizard_adjusted_help_one()
              : m.wizard_adjusted_help_other({ count })}
            {" ·"}
          </span>
          <button
            className={LINK}
            onClick={() => wizard.setValue("installments", null)}
            type="button"
          >
            {m.wizard_adjust_undo()}
          </button>
          <span aria-hidden="true">·</span>
        </>
      ) : (
        <span>{m.wizard_adjust_prompt()}</span>
      )}
      <button
        className={cn(LINK, "inline-flex items-center gap-0.5")}
        onClick={wizard.openAdjust}
        type="button"
      >
        {m.wizard_adjust_link()}
        <CaretRight aria-hidden="true" size={14} />
      </button>
    </p>
  );
}

/** Step 2 (mockup 15, A/D6): how it was agreed, the amounts, the first due date, and the way to adjust one by one. */
export function StepSchedule({ wizard }: { wizard: ContractWizard }) {
  const { locale, values } = wizard;
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
  const monthly = values.mode === "monthly";
  const modeError = errorOf("mode");
  return (
    <>
      <StepHeading
        headingRef={wizard.stepHeadingRef}
        hideLeadOnPhone
        lead={m.wizard_schedule_lead()}
        title={m.wizard_schedule_question()}
      />
      <OptionGroup
        className="mt-[18px] md:mt-[22px]"
        describedBy={modeError ? `${fieldId("mode")}-note` : undefined}
        id={fieldId("mode")}
        invalid={Boolean(modeError)}
        label={m.wizard_schedule_question()}
        layout="list"
        onValueChange={(value) =>
          wizard.setValue("mode", value as "split" | "monthly")
        }
        value={values.mode}
      >
        <OptionCard
          checked={values.mode === "split"}
          example={m.wizard_mode_split_example()}
          hint={<ResponsiveText narrow="" wide={m.wizard_mode_split_hint()} />}
          icon={Divide}
          title={
            <ResponsiveText
              narrow={m.wizard_mode_split_short()}
              wide={m.wizard_mode_split()}
            />
          }
          value="split"
          variant="list"
        />
        <OptionCard
          checked={monthly}
          example={
            <ResponsiveText
              narrow={m.wizard_mode_monthly_example_short()}
              wide={m.wizard_mode_monthly_example()}
            />
          }
          hint={
            <ResponsiveText narrow="" wide={m.wizard_mode_monthly_hint()} />
          }
          icon={ArrowsClockwise}
          title={
            <ResponsiveText
              narrow={m.wizard_mode_monthly_short()}
              wide={m.wizard_mode_monthly()}
            />
          }
          value="monthly"
          variant="list"
        />
      </OptionGroup>
      <FieldNote error={modeError} id={fieldId("mode")} />
      {values.mode ? (
        <>
          <div className="mt-[18px] grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-x-2.5 gap-y-3.5 md:mt-5 md:gap-x-3 md:gap-y-4">
            <AmountField wizard={wizard} />
            <TextField
              autoComplete="off"
              error={errorOf("count")}
              id={fieldId("count")}
              inputMode="numeric"
              label={monthly ? m.wizard_months_label() : m.wizard_count_label()}
              onBlur={() => wizard.blur("count")}
              onChange={(event) =>
                wizard.setValue("count", parseCount(event.target.value))
              }
              tall
              trailing={
                monthly ? m.wizard_months_suffix() : m.wizard_count_suffix()
              }
              value={values.count === null ? "" : String(values.count)}
            />
            <div className="col-span-2">
              <DateField
                error={errorOf("firstDueDate")}
                // Only the weekday: the preview is where the dates are (ajuste-15 §5.2).
                hint={
                  ISO_DATE.test(values.firstDueDate)
                    ? weekdayLong(values.firstDueDate, locale)
                    : undefined
                }
                id={fieldId("firstDueDate")}
                label={m.wizard_first_due_label()}
                onBlur={() => wizard.blur("firstDueDate")}
                onValueChange={(iso) => wizard.setValue("firstDueDate", iso)}
                tall
                value={values.firstDueDate}
                warning={warningOf("firstDueDate")}
              />
            </div>
          </div>
          <AdjustPrompt wizard={wizard} />
        </>
      ) : null}
    </>
  );
}
