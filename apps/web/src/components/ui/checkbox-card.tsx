import { Check } from "@phosphor-icons/react";
import { Checkbox } from "radix-ui";

/** A yes/no with its consequence, as a filled card (mockup 15, "Quero confirmar cada pagamento"). */
export function CheckboxCard({
  checked,
  hint,
  id,
  onCheckedChange,
  title,
}: {
  checked: boolean;
  hint: string;
  id: string;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card bg-surface-card px-3.5 py-3 md:px-4 md:py-3.5">
      <Checkbox.Root
        aria-describedby={`${id}-hint`}
        aria-labelledby={`${id}-title`}
        checked={checked}
        className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-surface shadow-[inset_0_0_0_1.5px_var(--field-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card data-[state=checked]:bg-brand data-[state=checked]:shadow-none dark:bg-surface-sunken"
        id={id}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      >
        <Checkbox.Indicator>
          {/* ink-inverse, not on-brand: in dark the brand turns light green (as StepAnchor). */}
          <Check className="text-ink-inverse" size={14} weight="bold" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label className="min-w-0 flex-1 cursor-pointer" htmlFor={id}>
        <span
          className="block font-semibold text-sm leading-[1.35]"
          id={`${id}-title`}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-[13px] text-ink-muted leading-[1.4]"
          id={`${id}-hint`}
        >
          {hint}
        </span>
      </label>
    </div>
  );
}
