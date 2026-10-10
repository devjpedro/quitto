import { type RefObject, useEffect, useState } from "react";

export interface SidewaysScroll {
  /** Some content is still past the right edge: the scroll has not reached the end. */
  moreToTheRight: boolean;
  /** The content is wider than the box, so it scrolls sideways. */
  scrolls: boolean;
}

/**
 * Whether the element's content is wider than its box, so it scrolls
 * sideways, and whether some of it is still past the right edge. A
 * scrollable region must be reachable by keyboard (WCAG 2.1.1, axe
 * scrollable-region-focusable): the chips strip takes a tab stop only while
 * it scrolls, on a phone, and never on a desktop where the chips wrap; and
 * its right edge fades while a chip is past it (decision 23). Both false on
 * the server and on the first render, so the SSR and the hydration agree.
 *
 * The box rarely changes size when the content does (a chip comes or goes,
 * an amount grows, the web font swaps in), so each child is watched too: the
 * ones there when the effect runs and any that comes later (a chip that takes
 * another's place keeps the count). `itemCount` measures again when items
 * come or go, and finds the element when the first one mounts it. A scroll
 * measures again, for the right edge.
 */
export function useScrollsSideways(
  ref: RefObject<HTMLElement | null>,
  itemCount: number
): SidewaysScroll {
  const [scrolls, setScrolls] = useState(false);
  const [moreToTheRight, setMoreToTheRight] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || itemCount === 0) {
      setScrolls(false);
      setMoreToTheRight(false);
      return;
    }
    const measure = () => {
      const overflow = element.scrollWidth - element.clientWidth;
      setScrolls(overflow > 0);
      // 1 px of slack: a fractional layout can stop scrollLeft a hair short of the end.
      setMoreToTheRight(overflow > 0 && element.scrollLeft < overflow - 1);
    };
    const resizes = new ResizeObserver(measure);
    resizes.observe(element);
    for (const child of element.children) {
      resizes.observe(child);
    }
    const arrivals = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            resizes.observe(node);
          }
        }
      }
      measure();
    });
    arrivals.observe(element, { childList: true });
    element.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      resizes.disconnect();
      arrivals.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [ref, itemCount]);
  return { moreToTheRight, scrolls };
}
