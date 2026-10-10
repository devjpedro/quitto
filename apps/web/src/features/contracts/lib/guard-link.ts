import type { MouseEvent } from "react";

/**
 * A link answers to the card's lock too: the second hit of a double tap must
 * not act on the card that slid into place.
 */
export const guardLink = (tryLock: () => boolean) => (event: MouseEvent) => {
  if (!tryLock()) {
    event.preventDefault();
  }
};
