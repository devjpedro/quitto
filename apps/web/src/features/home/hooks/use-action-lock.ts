import { useCallback, useRef } from "react";

/**
 * A card leaves the list as soon as its action starts (optimistic), so the
 * second hit of a double tap lands on the card that slid into its place.
 * One lock for the whole list swallows taps for a short window.
 */
export const ACTION_LOCK_MS = 700;

/** Returns `tryLock`: true (and locks) when an action may start now. */
export function useActionLock(): () => boolean {
  const lockedUntil = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now < lockedUntil.current) {
      return false;
    }
    lockedUntil.current = now + ACTION_LOCK_MS;
    return true;
  }, []);
}
