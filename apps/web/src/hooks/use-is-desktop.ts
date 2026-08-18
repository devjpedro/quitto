import { useCallback, useSyncExternalStore } from "react";

/** Casa com o breakpoint `sm` do Tailwind — o mesmo que separa sidebar de bottom-nav. */
const DESKTOP_QUERY = "(min-width: 640px)";

/**
 * `true` a partir do breakpoint `sm`. Client-only por construção: só é
 * consumido dentro da paleta, que só monta depois de um evento de cliente —
 * o `getServerSnapshot` nunca decide layout de verdade.
 */
export function useIsDesktop(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  );
}
