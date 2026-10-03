import { useCallback, useSyncExternalStore } from "react";

export const MD_UP = "(min-width: 768px)";

/** The home's side column (tokens.css --breakpoint-lateral, 90rem). In px: the test setup's matchMedia reads px. */
export const LATERAL_UP = "(min-width: 1440px)";

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
