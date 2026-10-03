import { useLayoutEffect, useRef } from "react";

/**
 * The last action takes the whole list off the page (the home stops
 * rendering it), and the focused button goes with it: the focus would fall
 * to the body. Hands it to the summary line, which stays through every
 * layout that can follow (nothing pending, the green guide, the empty home)
 * and now says so. Only a focus that was lost moves: someone focused
 * elsewhere when the list empties from outside keeps their place.
 */
export function useFocusAfterLastAction(actionCount: number) {
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const previousCount = useRef(actionCount);

  useLayoutEffect(() => {
    const hadActions = previousCount.current > 0;
    previousCount.current = actionCount;
    const focusLost =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (hadActions && actionCount === 0 && focusLost) {
      summaryRef.current?.focus();
    }
  }, [actionCount]);

  return summaryRef;
}
