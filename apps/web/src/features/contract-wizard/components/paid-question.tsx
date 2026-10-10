import { Check } from "@phosphor-icons/react";
import { Checkbox } from "radix-ui";
import { DateTile } from "@/components/ui/date-tile";
import { Money } from "@/components/ui/money";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { weekdayLong } from "@/lib/date-parts";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { pastRows, type WizardValues } from "../lib/wizard-values";

type Answer = WizardValues["paid"];

function helpText(answer: Answer, count: number, paid: number): string {
  if (answer === "some") {
    return m.wizard_paid_help_some({ paid, count });
  }
  if (answer === "all") {
    return count === 1
      ? m.wizard_paid_help_all_one()
      : m.wizard_paid_help_all_other({ count });
  }
  return count === 1
    ? m.wizard_paid_help_none_one()
    : m.wizard_paid_help_none_other({ count });
}

/** "Algumas": a tick on each installment due before today, in the rows' own layout (tile, date, amount). */
function PaidList({ wizard }: { wizard: ContractWizard }) {
  const { locale, today, values } = wizard;
  const rows = pastRows(values, today);
  const total = values.installments?.length ?? rows.length;
  const count = Math.max(total, rows.length);
  const toggle = (sequence: number, on: boolean) =>
    wizard.setValue(
      "paidSequences",
      on
        ? [...values.paidSequences, sequence]
        : values.paidSequences.filter((it) => it !== sequence)
    );
  return (
    <ul
      aria-label={m.wizard_paid_list_label()}
      className="mt-3 max-h-[min(340px,48vh)] divide-y divide-divider overflow-y-auto rounded-card bg-surface-card"
      data-testid="paid-list"
    >
      {rows.map((row) => {
        const checked = values.paidSequences.includes(row.sequence);
        const id = `paid-${row.sequence}`;
        return (
          <li
            className="flex min-h-14 items-center gap-3 py-2 pr-3.5 pl-2"
            key={row.sequence}
          >
            <DateTile iso={row.dueDate} locale={locale} />
            <label
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              htmlFor={id}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[13.5px] leading-[1.3]">
                  {m.preview_installment({
                    sequence: row.sequence,
                    count: wizard.preview.count || count,
                  })}
                </span>
                <span className="mt-0.5 block truncate text-ink-muted text-xs tabular-nums">
                  {weekdayLong(row.dueDate, locale)}{" "}
                  {m.home_dot_after({
                    text: formatDate(row.dueDate, locale, "short"),
                  })}
                </span>
              </span>
              <Money cents={row.amountCents} size="list" />
            </label>
            <Checkbox.Root
              aria-label={m.wizard_paid_row({
                sequence: row.sequence,
                count: wizard.preview.count || count,
              })}
              checked={checked}
              className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-surface shadow-[inset_0_0_0_1.5px_var(--field-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card data-[state=checked]:bg-brand data-[state=checked]:shadow-none dark:bg-surface-sunken"
              id={id}
              onCheckedChange={(value) => toggle(row.sequence, value === true)}
            >
              <Checkbox.Indicator>
                <Check className="text-ink-inverse" size={15} weight="bold" />
              </Checkbox.Indicator>
            </Checkbox.Root>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "As parcelas antes de hoje já foram pagas?" (step 2): shown only when some
 * installment is due before today, in place of the old "data já passou"
 * warning. Todas is the answer it opens on; Algumas lists the due ones to tick.
 */
export function PaidQuestion({ wizard }: { wizard: ContractWizard }) {
  const { today, values } = wizard;
  const past = pastRows(values, today);
  if (past.length === 0) {
    return null;
  }
  const paid =
    values.paid === "all"
      ? past.length
      : past.filter((row) => values.paidSequences.includes(row.sequence))
          .length;
  return (
    <section
      aria-labelledby="paid-question"
      className="mt-5 md:mt-6"
      data-testid="paid-question"
    >
      <h3 className="font-medium text-[15px] leading-[1.35]" id="paid-question">
        {m.wizard_paid_question()}
      </h3>
      <div className="mt-2.5">
        <SegmentedControl<Answer>
          block
          label={m.wizard_paid_question()}
          onValueChange={(value) => wizard.setValue("paid", value)}
          options={[
            { value: "all", label: m.wizard_paid_all() },
            { value: "none", label: m.wizard_paid_none() },
            { value: "some", label: m.wizard_paid_some() },
          ]}
          value={values.paid}
        />
      </div>
      <p
        aria-live="polite"
        className="mt-2 text-[13px] text-ink-muted leading-[1.4]"
      >
        {helpText(values.paid, past.length, paid)}
      </p>
      {values.paid === "some" ? <PaidList wizard={wizard} /> : null}
    </section>
  );
}
