import { useState } from "react";

/**
 * The "Ver todas" state of the action cards, shared by the desktop's button
 * (on the chips row), the phone's (under the carousel) and the list. A list
 * that empties closes it, so the next cards (a refetch, an accepted invite)
 * come back as the row or the carousel, never as an open list. Adjusted
 * while rendering: no effect, and no frame drawn with the stale state.
 */
export function useSeeAll(count: number): {
  expanded: boolean;
  toggle: () => void;
} {
  const [expanded, setExpanded] = useState(false);
  if (expanded && count === 0) {
    setExpanded(false);
  }
  const toggle = () => setExpanded((value) => !value);
  return { expanded, toggle };
}
