import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Cards in the desktop row at lg; 2xl fits a fourth and wide a fifth. */
const DESKTOP_VISIBLE = 3;

/** Shown while some card is past the row: N > 3 below 2xl, N > 4 below wide, N > 5 from wide. */
function seeAllClasses(count: number): string {
  return cn(
    "hidden shrink-0 justify-end lg:flex",
    count <= 4 && "2xl:hidden",
    count <= 5 && "wide:hidden"
  );
}

/** The desktop's "Ver todas (N)" for the action cards; the phone's lives under the carousel. */
export function SeeAllButton({
  count,
  expanded,
  listId,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  listId: string;
  onToggle: () => void;
}) {
  if (count <= DESKTOP_VISIBLE) {
    return null;
  }
  const Caret = expanded ? CaretUp : CaretDown;
  return (
    <div className={seeAllClasses(count)}>
      <Button
        aria-controls={listId}
        aria-expanded={expanded}
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        {expanded ? m.home_see_less() : m.home_see_all_count({ count })}
        <Caret aria-hidden="true" size={16} />
      </Button>
    </div>
  );
}

/**
 * The chips with "Ver todas (N)" at the right end of the same row (DIRECAO ›
 * Layout): never a line of its own between the cards and the next block.
 */
export function ChipsRow({
  chips,
  count,
  expanded,
  listId,
  onToggle,
}: {
  chips: ReactNode;
  count: number;
  expanded: boolean;
  listId: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      {chips}
      <SeeAllButton
        count={count}
        expanded={expanded}
        listId={listId}
        onToggle={onToggle}
      />
    </div>
  );
}
