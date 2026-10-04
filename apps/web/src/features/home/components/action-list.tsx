import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useActionFocus } from "../hooks/use-action-focus";
import { useActionLock } from "../hooks/use-action-lock";
import { useCarouselIndex } from "../hooks/use-carousel-index";
import type { HomeAction } from "../types";
import { ActionCard } from "./action-card";
import { pastTheRow } from "./cards-per-row";
import { FEW_SPANS } from "./home-grid";

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
 * Below lg: a scroll-snap carousel where the next card peeks at the edge,
 * with "1 de N" and "Ver todas" (which turns it into a list). From lg (the
 * sidebar leaves no room for three columns at md): a grid that grows by
 * columns, never by stretching a card (3, then 4 at 2xl and 5 at wide), with
 * "Ver todas (N)" for the rest on the chips row (ChipsRow), which shares
 * `expanded`. A single action takes the full width, and two columns of the
 * grid. With few cards (`few`), from lateral the section is a subgrid of the
 * home's actions row, so "Próximos 30 dias" can take the free tracks beside it.
 */
export function ActionList({
  actions,
  expanded,
  few = null,
  listId,
  onToggle,
  today,
}: {
  actions: HomeAction[];
  expanded: boolean;
  few?: 1 | 2 | null;
  listId: string;
  onToggle: () => void;
  today: string;
}) {
  const { ref, index } = useCarouselIndex(actions.length, expanded);
  const tryLock = useActionLock();
  const { sectionRef, onActionStart } = useActionFocus(actions);
  const single = actions.length === 1;
  return (
    <section
      aria-label={m.home_actions_title()}
      className={cn(
        "flex flex-col gap-3 focus:outline-none",
        few && [
          "lateral:grid lateral:grid-cols-subgrid",
          FEW_SPANS[few].actions,
        ]
      )}
      onKeyDownCapture={swallowKeyRepeat}
      ref={sectionRef}
    >
      <ul
        className={cn(
          // relative: the cards' sr-only texts are absolute, and without a
          // positioned ancestor here they escape the carousel's overflow-x
          // and widen the whole page.
          "relative flex gap-3",
          expanded
            ? "flex-col"
            : "-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6",
          "lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] lg:overflow-visible lg:px-0",
          few
            ? "lateral:col-span-full lateral:grid-cols-subgrid"
            : "wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]"
        )}
        id={listId}
        ref={ref}
      >
        {actions.map((action, i) => (
          <li
            className={cn(
              expanded || single
                ? "w-full"
                : "w-[calc(100%-2.75rem)] shrink-0 snap-start",
              "lg:w-auto",
              single &&
                (few ? "lateral:col-span-1 lg:col-span-2" : "lg:col-span-2"),
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
            aria-controls={listId}
            aria-expanded={expanded}
            onClick={onToggle}
            size="sm"
            variant="ghost"
          >
            {expanded ? m.home_see_less() : m.home_see_all()}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
