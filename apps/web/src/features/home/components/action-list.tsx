import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useActionFocus } from "../hooks/use-action-focus";
import { useActionLock } from "../hooks/use-action-lock";
import { useCarouselIndex } from "../hooks/use-carousel-index";
import type { HomeAction } from "../types";
import { ActionCard } from "./action-card";

/** Cards in the desktop row at lg; 2xl fits a fourth and wide a fifth. */
const DESKTOP_VISIBLE = 3;

/**
 * A held Enter or Space repeats its keydown, and every repeat would activate
 * the button that has the focus by then: the first button of the card that
 * took the place of the one just acted on, once the 700 ms lock is over.
 * Cancelling the repeated keydown cancels that activation: only the first
 * press acts.
 */
function swallowKeyRepeat(event: KeyboardEvent) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
  }
}

/**
 * Hides a card past the desktop row, by CSS only: every card is in the HTML,
 * so the SSR and the hydration pass agree at any width. 3 per row from lg,
 * 4 from 2xl (1536 px), 5 from wide (1840 px).
 */
function pastTheRow(index: number): string | false {
  if (index === 3) {
    return "lg:hidden 2xl:block";
  }
  if (index === 4) {
    return "lg:hidden wide:block";
  }
  return index > 4 && "lg:hidden";
}

/** "Ver todas (N)" while some card is past the row: N > 3 below 2xl, N > 4 below wide, N > 5 from wide. */
function seeAllRow(count: number): string {
  return cn(
    "hidden justify-end lg:flex",
    count <= 4 && "2xl:hidden",
    count <= 5 && "wide:hidden"
  );
}

/**
 * Below lg: a scroll-snap carousel where the next card peeks at the edge,
 * with "1 de N" and "Ver todas" (which turns it into a list). From lg (the
 * sidebar leaves no room for three columns at md): a grid that grows by
 * columns, never by stretching a card (3, then 4 at 2xl and 5 at wide), with
 * "Ver todas (N)" for the rest. A single action takes the full width, and
 * two columns of the grid.
 */
export function ActionList({
  actions,
  today,
}: {
  actions: HomeAction[];
  today: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { ref, index } = useCarouselIndex(actions.length, expanded);
  const tryLock = useActionLock();
  const { sectionRef, onActionStart } = useActionFocus(actions);
  const single = actions.length === 1;
  const toggle = () => setExpanded((value) => !value);
  return (
    <section
      aria-label={m.home_actions_title()}
      className="flex flex-col gap-2 focus:outline-none"
      onKeyDownCapture={swallowKeyRepeat}
      ref={sectionRef}
    >
      <ul
        className={cn(
          // relative: the cards' sr-only texts are absolute, and without a
          // positioned ancestor here they escape the carousel's overflow-x
          // and widen the whole page.
          "relative flex gap-2",
          expanded
            ? "flex-col"
            : "-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6",
          "lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] lg:overflow-visible lg:px-0",
          "wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]"
        )}
        ref={ref}
      >
        {actions.map((action, i) => (
          <li
            className={cn(
              expanded || single
                ? "w-full"
                : "w-[calc(100%-2.75rem)] shrink-0 snap-start",
              "lg:w-auto",
              single && "lg:col-span-2",
              !expanded && pastTheRow(i)
            )}
            key={action.id}
          >
            <ActionCard
              action={action}
              first={i === 0}
              onActionStart={onActionStart}
              today={today}
              tryLock={tryLock}
            />
          </li>
        ))}
      </ul>
      {actions.length > 1 ? (
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-ink-muted text-sm tabular-nums">
            {expanded
              ? null
              : m.home_carousel_position({
                  index: index + 1,
                  count: actions.length,
                })}
          </span>
          <Button
            aria-expanded={expanded}
            onClick={toggle}
            size="sm"
            variant="ghost"
          >
            {expanded ? m.home_see_less() : m.home_see_all()}
          </Button>
        </div>
      ) : null}
      {actions.length > DESKTOP_VISIBLE ? (
        <div className={seeAllRow(actions.length)}>
          <Button
            aria-expanded={expanded}
            onClick={toggle}
            size="sm"
            variant="ghost"
          >
            {expanded
              ? m.home_see_less()
              : m.home_see_all_count({ count: actions.length })}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
