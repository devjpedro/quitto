import { useCallback, useSyncExternalStore } from "react";

export const MD_UP = "(min-width: 768px)";

/**
 * The home's side column: tokens.css --breakpoint-lateral, in the same rem.
 * In a media query rem is the browser's font size, so px would part from the
 * CSS whenever that is not 16 px.
 */
export const LATERAL_UP = "(min-width: 90rem)";

/** Reactive media query. `serverValue` is used during SSR and hydration. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
