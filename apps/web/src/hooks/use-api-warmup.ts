import { useEffect } from "react";

/**
 * Wakes the API (Fly scales to zero) as soon as a public entry page mounts,
 * so it's warm by the time the user submits. Fire-and-forget.
 */
export function useApiWarmup(): void {
  useEffect(() => {
    fetch("/api/ping", { cache: "no-store" }).catch(() => undefined);
  }, []);
}
