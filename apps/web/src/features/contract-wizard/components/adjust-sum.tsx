import { Check, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { errorCodeText } from "@/lib/error-codes";
import { formatMoney } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { adjustState } from "../lib/adjust";
import { fieldId } from "../lib/field-id";

function takeLabel(direction: "over" | "under", amount: string, count: number) {
  if (direction === "over") {
    return count === 1
      ? m.wizard_fix_take_one({ amount })
      : m.wizard_fix_take_other({ amount, count });
  }
  return count === 1
    ? m.wizard_fix_add_one({ amount })
    : m.wizard_fix_add_other({ amount, count });
}

/**
 * The sum under the list (mockup 15, D5/D7). When it does not add up, the
 * block turns danger-subtle, says by how much, and offers the two one-tap
 * fixes; "Continuar" sends the focus here (it is the field "installments").
 * On a phone it sits in the action bar, above "Continuar" (E7).
 */
export function AdjustSum({ wizard }: { wizard: ContractWizard }) {
  const { locale } = wizard;
  const state = adjustState(wizard.values);
  if (!state) {
    return null;
  }
  const id = fieldId("installments");
  const { mismatch } = state;
  const diff = mismatch ? formatMoney(mismatch.diff, locale) : "";
  return (
    <div
      aria-describedby={mismatch ? `${id}-note` : undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-card px-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        mismatch ? "bg-danger-subtle" : "bg-surface-card"
      )}
      id={id}
      tabIndex={-1}
    >
      <div className="min-w-0 flex-1">
        <small
          className={cn(
            "block text-xs",
            mismatch ? "text-danger" : "text-ink-muted"
          )}
        >
          {state.count === 1
            ? m.wizard_adjust_sum_one()
            : m.wizard_adjust_sum_other({ count: state.count })}
        </small>
        <Money
          cents={state.sum}
          className={mismatch ? "text-danger" : undefined}
          size="list"
        />{" "}
        <span
          className={cn(
            "text-[12.5px] tabular-nums",
            mismatch ? "text-danger" : "text-ink-muted"
          )}
        >
          {m.wizard_adjust_of({ total: formatMoney(state.total, locale) })}
        </span>
      </div>
      {mismatch ? (
        <Tag tone="danger">
          <WarningCircle aria-hidden="true" size={12} weight="bold" />
          {mismatch.direction === "over"
            ? m.wizard_adjust_over({ amount: diff })
            : m.wizard_adjust_under({ amount: diff })}
        </Tag>
      ) : (
        <Tag tone="brand">
          <Check aria-hidden="true" size={12} weight="bold" />
          {m.wizard_adjust_ok()}
        </Tag>
      )}
      {mismatch ? (
        <>
          <p
            className="flex w-full items-start gap-1.5 font-medium text-[12.5px] text-danger leading-[1.4]"
            id={`${id}-note`}
          >
            <WarningCircle
              aria-hidden="true"
              className="mt-px shrink-0"
              size={15}
              weight="fill"
            />
            {errorCodeText(
              mismatch.direction === "over"
                ? "installments.sum.over"
                : "installments.sum.under",
              { diff: mismatch.diff },
              locale
            )}{" "}
            {m.wizard_adjust_choose()}
          </p>
          <div className="flex w-full flex-wrap gap-2">
            {state.take ? (
              <Button
                onClick={() => wizard.setValue("installments", state.take)}
                size="sm"
                variant="inset"
              >
                {takeLabel(mismatch.direction, diff, state.freeCount)}
              </Button>
            ) : null}
            {state.useTotal ? (
              <Button
                onClick={() => {
                  if (state.useTotal) {
                    wizard.replace(state.useTotal);
                  }
                }}
                size="sm"
                variant="inset"
              >
                {m.wizard_fix_use_total({
                  amount: formatMoney(state.sum, locale),
                })}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** "1 · parcela que você mudou": the lime tile's key, under the sum (from md). */
export function AdjustLegend({ wizard }: { wizard: ContractWizard }) {
  const edited =
    wizard.values.installments?.findIndex((row) => row.edited) ?? -1;
  if (edited < 0) {
    return null;
  }
  return (
    <p className="mt-2.5 flex items-center gap-2 text-ink-muted text-xs max-md:hidden">
      <span
        aria-hidden="true"
        className="flex size-[18px] items-center justify-center rounded-[5px] bg-highlight font-mono text-[10px] text-on-highlight"
      >
        {edited + 1}
      </span>
      {m.wizard_adjust_legend()}
    </p>
  );
}
