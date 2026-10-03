import { useEffect, useRef, useState } from "react";
import { indexFromScroll } from "../lib/carousel";

/**
 * Which card leads the horizontal list, for the "1 de N" counter. Measured
 * on scroll and again whenever the list goes back to a carousel: collapsing
 * "Ver todas" lands on the first card without any scroll event.
 */
export function useCarouselIndex(count: number, expanded: boolean) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const list = ref.current;
    if (!list || expanded) {
      // As a vertical list there is no position to track.
      return;
    }
    const onScroll = () => {
      const first = list.firstElementChild;
      const width = first instanceof HTMLElement ? first.offsetWidth : 0;
      const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
      setIndex(indexFromScroll(list.scrollLeft, width + gap, count));
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => list.removeEventListener("scroll", onScroll);
  }, [count, expanded]);
  return { ref, index };
}
