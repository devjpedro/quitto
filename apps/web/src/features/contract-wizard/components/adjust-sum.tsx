import { Button } from "@/components/ui/button";
import { FieldNote } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { errorCodeText } from "@/lib/error-codes";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { type AdjustState, adjustState } from "../lib/adjust";
import { fieldId } from "../lib/field-id";

function sumLabel({ count, moved }: AdjustState): string {
  if (moved) {
    return count === 1
      ? m.wizard_adjust_now_one()
      : m.wizard_adjust_now_other({ count });
  }
  return count === 1
    ? m.wizard_adjust_sum_one()
    : m.wizard_adjust_sum_other({ count });
}

/**
 * The total under the list (mockup 20, B7). It is the sum of the rows and
 * never blocks: when it moved, the block says "Total agora R$ X · era R$ Y"
 * and offers "Manter R$ Y", which takes the difference from the rows the
 * person did not change. On a phone it sits in the action bar, above "Continuar".
 */
export function AdjustSum({ wizard }: { wizard: ContractWizard }) {
  const { locale } = wizard;
  const state = adjustState(wizard.values);
  if (!state) {
    return null;
  }
  const id = fieldId("installments");
  const issue = wizard.issueFor("installments");
  const error = issue
    ? errorCodeText(issue.code, issue.params ?? {}, locale)
    : undefined;
  const previous = formatMoney(state.previous, locale);
  const { keep } = state;
  return (
    <div
      aria-describedby={error ? `${id}-note` : undefined}
      className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-card bg-surface-card px-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      id={id}
      tabIndex={-1}
    >
      <div className="min-w-0 flex-1">
        <small className="block text-ink-muted text-xs">
          {sumLabel(state)}
        </small>
        <Money cents={state.sum} size="list" />{" "}
        {state.moved ? (
          <span className="text-[12.5px] text-ink-muted tabular-nums">
            {m.wizard_adjust_was()} <s>{previous}</s>
          </span>
        ) : null}
      </div>
      {state.moved && keep ? (
        <Button
          onClick={() => wizard.setValue("installments", keep)}
          size="sm"
          variant="inset"
        >
          {m.wizard_adjust_keep({ total: previous })}
        </Button>
      ) : null}
      {error ? (
        <div className="w-full">
          <FieldNote error={error} id={id} />
        </div>
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
