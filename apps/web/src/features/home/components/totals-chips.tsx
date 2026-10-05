import {
  ArrowDownLeft,
  ArrowUpRight,
  type Icon,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ReactNode, useRef } from "react";
import { Money } from "@/components/ui/money";
import { useScrollsSideways } from "@/hooks/use-scrolls-sideways";
import { pluralForm } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

const CHIP =
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

function MoneyChip({
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

/**
 * The home's totals as filled chips (mockup 13): what needs you (cards, not
 * installments), what is overdue (owner's decision 8, by direction and never
 * summed, with an icon so the status is not color alone) and what falls due
 * within 30 days, looking ahead only.
 */
export function TotalsChips({
  overdueToPayCents,
  overdueToReceiveCents,
  pendingCount,
  toPayCents,
  toReceiveCents,
}: {
  overdueToPayCents: number;
  overdueToReceiveCents: number;
  pendingCount: number;
  toPayCents: number;
  toReceiveCents: number;
}) {
  const stripRef = useRef<HTMLUListElement>(null);
  const chips: ReactNode[] = [];
  if (pendingCount > 0) {
    const one = pluralForm(pendingCount, getLocale()) === "one";
    chips.push(
      <li className={cn(CHIP, "bg-highlight text-on-highlight")} key="pending">
        <span className="font-semibold tabular-nums">{pendingCount}</span>{" "}
        {one ? m.home_chip_pending_one() : m.home_chip_pending_other()}
      </li>
    );
  }
  if (overdueToPayCents > 0) {
    chips.push(
      <MoneyChip
        cents={overdueToPayCents}
        icon={WarningCircle}
        key="overdue-pay"
        label={m.home_chip_overdue_pay()}
        tone="danger"
      />
    );
  }
  if (overdueToReceiveCents > 0) {
    chips.push(
      <MoneyChip
        cents={overdueToReceiveCents}
        icon={WarningCircle}
        key="overdue-receive"
        label={m.home_chip_overdue_receive()}
        tone="danger"
      />
    );
  }
  if (toPayCents > 0) {
    chips.push(
      <MoneyChip
        cents={toPayCents}
        icon={ArrowUpRight}
        key="to-pay"
        label={m.home_chip_to_pay()}
        tone="plain"
      />
    );
  }
  if (toReceiveCents > 0) {
    chips.push(
      <MoneyChip
        cents={toReceiveCents}
        icon={ArrowDownLeft}
        key="to-receive"
        label={m.home_chip_to_receive()}
        tone="plain"
      />
    );
  }
  // Before the early return (a hook on every render); the count re-measures when chips come or go.
  const { moreToTheRight, scrolls } = useScrollsSideways(
    stripRef,
    chips.length
  );
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className={FRAME}>
      <ul
        aria-label={m.home_chips_label()}
        className={cn(STRIP, moreToTheRight && FADE_RIGHT)}
        ref={stripRef}
        // A tab stop only while it scrolls (useScrollsSideways).
        tabIndex={scrolls ? 0 : undefined}
      >
        {chips}
      </ul>
    </div>
  );
}
