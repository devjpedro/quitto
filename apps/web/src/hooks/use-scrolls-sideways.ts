import { type RefObject, useEffect, useState } from "react";

/**
 * True while the element's content is wider than its box, so it scrolls
 * sideways. A scrollable region must be reachable by keyboard (WCAG 2.1.1,
 * axe scrollable-region-focusable): the chips strip takes a tab stop only
 * then, on a phone, and never on a desktop where the chips wrap. False on the
 * server and on the first render, so the SSR and the hydration agree.
 *
 * The box rarely changes size when the content does (a chip comes or goes,
 * an amount grows, the web font swaps in), so each child is watched too, and
 * `itemCount` measures again (and watches the new children) when items come
 * or go.
 */
export function useScrollsSideways(
  ref: RefObject<HTMLElement | null>,
  itemCount: number
): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || itemCount === 0) {
      setScrolls(false);
      return;
    }
    const measure = () => setScrolls(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [ref, itemCount]);
  return scrolls;
}
