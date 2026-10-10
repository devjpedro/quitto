import type { Icon } from "@phosphor-icons/react";
import { RadioGroup } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A choice as a filled card (DIRECAO › Forma): surface-card at rest, the
 * selected tint when chosen, a step down on hover; never an outline. One
 * radiogroup: arrows move the choice, Tab leaves it.
 */
export function OptionGroup({
  children,
  className,
  describedBy,
  id,
  invalid = false,
  label,
  layout,
  onValueChange,
  value,
}: {
  children: ReactNode;
  className?: string;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  label: string;
  layout: "tall" | "list";
  onValueChange: (value: string) => void;
  value: string | null;
}) {
  return (
    <RadioGroup.Root
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-label={label}
      className={cn(
        layout === "tall" ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-2",
        className
      )}
      id={id}
      onValueChange={onValueChange}
      value={value ?? ""}
    >
      {children}
    </RadioGroup.Root>
  );
}

const CARD =
  "group relative flex min-w-0 cursor-pointer rounded-card bg-surface-card text-left text-ink transition-[background-color,transform] duration-150 hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[.97] motion-reduce:active:scale-100 data-[state=checked]:bg-surface-selected data-[state=checked]:hover:bg-surface-selected-hover";

const VARIANT = {
  tall: "min-h-[148px] flex-col p-3.5 md:min-h-40 md:p-4",
  list: "items-start gap-3 py-3 pr-3.5 pl-3 md:gap-3.5 md:py-3.5 md:pr-4 md:pl-3.5",
} as const;

export function OptionCard({
  checked,
  example,
  hint,
  icon: OptionIcon,
  title,
  value,
  variant,
}: {
  checked: boolean;
  /** ReactNode: Tasks 6B, 7 and 8 pass a ResponsiveText (the short text below 1140), even as the title. */
  example?: ReactNode;
  hint?: ReactNode;
  icon: Icon;
  title: ReactNode;
  value: string;
  variant: "tall" | "list";
}) {
  const titleId = useId();
  const detailId = useId();
  return (
    <RadioGroup.Item
      aria-describedby={hint || example ? detailId : undefined}
      aria-labelledby={titleId}
      className={cn(CARD, VARIANT[variant])}
      value={value}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-control bg-surface-inset text-brand group-data-[state=checked]:bg-brand-surface group-data-[state=checked]:text-on-brand",
          variant === "tall" ? "size-11" : "size-10"
        )}
      >
        <OptionIcon
          aria-hidden="true"
          size={variant === "tall" ? 22 : 20}
          weight={checked ? "fill" : "regular"}
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1",
          variant === "tall" ? "mt-3.5 md:mt-4" : "pt-px"
        )}
      >
        <span
          className={cn(
            "block font-semibold leading-[1.35]",
            variant === "tall" ? "text-[15px] md:text-base" : "text-sm"
          )}
          id={titleId}
        >
          {title}
        </span>
        <span id={detailId}>
          {hint ? (
            <span className="mt-0.5 block text-[13px] text-ink-muted leading-[1.4]">
              {hint}
            </span>
          ) : null}
          {example ? (
            <span className="mt-2 inline-flex rounded-full bg-surface-inset px-2 py-px font-medium text-[11.5px] text-ink-muted leading-[18px] group-data-[state=checked]:bg-surface">
              {example}
            </span>
          ) : null}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "size-5 shrink-0 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--field-line)] group-data-[state=checked]:shadow-[inset_0_0_0_6px_var(--brand)] dark:bg-surface-sunken",
          variant === "tall"
            ? "absolute top-3.5 right-3.5 md:top-4 md:right-4"
            : "mt-0.5"
        )}
      />
    </RadioGroup.Item>
  );
}
