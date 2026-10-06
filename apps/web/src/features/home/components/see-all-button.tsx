import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import { seeAllClasses } from "./cards-per-row";

/** The desktop's "Ver todas" for the action cards; the phone's lives under the carousel. */
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
  const classes = seeAllClasses(count);
  if (!classes) {
    return null;
  }
  const Caret = expanded ? CaretUp : CaretDown;
  return (
    <div className={classes}>
      <Button
        aria-controls={listId}
        aria-expanded={expanded}
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        {expanded ? m.home_see_less() : m.home_see_all()}
        <Caret aria-hidden="true" size={16} />
      </Button>
    </div>
  );
}
