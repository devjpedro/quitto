import { RadioGroup } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A pair of choices as filled cards (DIRECAO › Forma): `surface-card` at
 * rest, the selected tint when chosen, a step down on hover, never an
 * outline. One radiogroup: arrows move the choice, Tab leaves it.
 * `stacked` puts them one under the other on a phone (the language's, whose
 * lines are long); otherwise they share the row (the theme's thumbnails).
 */
export function ChoiceGroup({
  children,
  label,
  onValueChange,
  stacked = false,
  value,
}: {
  children: ReactNode;
  label: string;
  onValueChange: (value: string) => void;
  stacked?: boolean;
  value: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      className={cn(
        "grid gap-2.5",
        stacked ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"
      )}
      onValueChange={onValueChange}
      value={value}
    >
      {children}
    </RadioGroup.Root>
  );
}

const CARD =
  "group relative flex min-w-0 cursor-pointer rounded-card bg-surface-card p-3.5 text-left text-ink transition-[background-color,transform] duration-150 hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[.97] motion-reduce:active:scale-100 data-[state=checked]:bg-surface-selected data-[state=checked]:hover:bg-surface-selected-hover";

/** The radio's dot, in the card's corner or at the end of its line. */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="size-5 shrink-0 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--field-line)] group-data-[state=checked]:shadow-[inset_0_0_0_6px_var(--brand)] dark:bg-surface-sunken"
    />
  );
}

/** One choice with its name and a line that shows it (the language, with today's date and a price in it). */
export function ChoiceCard({
  example,
  title,
  value,
}: {
  example: string;
  title: string;
  value: string;
}) {
  const titleId = useId();
  const exampleId = useId();
  return (
    <RadioGroup.Item
      aria-describedby={exampleId}
      aria-labelledby={titleId}
      className={cn(CARD, "items-start justify-between gap-3")}
      value={value}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-sm" id={titleId}>
          {title}
        </span>
        <span
          className="mt-0.5 block text-[13px] text-ink-muted tabular-nums"
          id={exampleId}
        >
          {example}
        </span>
      </span>
      <Dot />
    </RadioGroup.Item>
  );
}

/** One choice with a thumbnail of what it looks like (the theme). The picture is decorative: the name says it. */
export function ThumbnailCard({
  picture,
  title,
  value,
}: {
  picture: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <RadioGroup.Item className={cn(CARD, "flex-col gap-3")} value={value}>
      <span aria-hidden="true" className="block">
        {picture}
      </span>
      <span className="flex items-center justify-between">
        <span className="font-semibold text-sm">{title}</span>
        <Dot />
      </span>
    </RadioGroup.Item>
  );
}
