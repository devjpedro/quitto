import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import { pendingHomeActionIds } from "../use-home-action-mutation";

/**
 * The last action takes the whole list off the page (the home stops
 * rendering it), and the focus that was on its button falls to the body.
 * Hands it to the summary line, which stays through every layout that can
 * follow (nothing pending, the green guide, the empty home) and now says so:
 * the same hand-off the list does for the other cards.
 *
 * Only when the list emptied because someone acted on it (a home action is
 * in flight, its optimistic update took the last card) and the focus is
 * lost. A refetch that empties the list from outside (the other party paid,
 * back to the tab) never moves the focus nor scrolls the page. Checked when
 * the list leaves, not when the action starts: Chromium already drops the
 * focus of the button that turns disabled while busy, before the card goes.
 */
export function useFocusAfterLastAction(actionCount: number) {
  const client = useQueryClient();
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const previousCount = useRef(actionCount);

  useLayoutEffect(() => {
    const emptied = previousCount.current > 0 && actionCount === 0;
    previousCount.current = actionCount;
    const focusLost =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (emptied && focusLost && pendingHomeActionIds(client).length > 0) {
      summaryRef.current?.focus();
    }
  }, [actionCount, client]);

  return summaryRef;
}
