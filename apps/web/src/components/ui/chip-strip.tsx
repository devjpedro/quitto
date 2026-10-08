import type { Icon } from "@phosphor-icons/react";
import { Children, type ReactNode, useRef } from "react";
import { Money } from "@/components/ui/money";
import { useScrollsSideways } from "@/hooks/use-scrolls-sideways";
import { cn } from "@/lib/utils";

export const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13.5px]";

/**
 * The frame around the strip: below md it bleeds to the screen edge, and it
 * draws the strip's focus ring, outside. Not the list's own ring: the fade's
 * mask clips whatever the list paints past its box, and an inset ring would
 * paint under the chips.
 */
const FRAME =
  "min-w-0 rounded-control has-focus-visible:ring-2 has-focus-visible:ring-brand max-md:-mx-4";

/**
 * Below md the strip is one line that scrolls sideways (mockup 13, frame D);
 * the gutter padding lets the last chip scroll fully into view. From md it
 * wraps.
 */
const STRIP =
  "flex gap-1.5 focus-visible:outline-none max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] md:flex-wrap";

/**
 * While a chip is past the right edge, that edge fades (decision 23): a hint
 * that does not depend on where a chip happens to end. A mask, not a color,
 * so it works on any background, light or dark; gone at the end of the scroll.
 */
const FADE_RIGHT =
  "max-md:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]";

/** A line of chips (a list's `li`s): one scrolling line on a phone, wrapping from md. */
export function ChipStrip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const stripRef = useRef<HTMLUListElement>(null);
  // The count re-measures when chips come or go.
  const { moreToTheRight, scrolls } = useScrollsSideways(
    stripRef,
    Children.count(children)
  );
  return (
    <div className={FRAME}>
      <ul
        aria-label={label}
        className={cn(STRIP, moreToTheRight && FADE_RIGHT)}
        ref={stripRef}
        // A tab stop only while it scrolls (useScrollsSideways).
        tabIndex={scrolls ? 0 : undefined}
      >
        {children}
      </ul>
    </div>
  );
}

export function MoneyChip({
  cents,
  icon: IconComponent,
  label,
  tone,
}: {
  cents: number;
  icon: Icon;
  label: string;
  tone: "danger" | "plain";
}) {
  const danger = tone === "danger";
  return (
    <li
      className={cn(
        CHIP,
        danger
          ? "bg-danger-subtle text-danger"
          : "bg-surface-card text-ink-muted"
      )}
    >
      <IconComponent aria-hidden="true" size={15} />
      <Money
        cents={cents}
        className={cn("font-semibold", danger ? "text-danger" : "text-ink")}
      />{" "}
      {label}
    </li>
  );
}
