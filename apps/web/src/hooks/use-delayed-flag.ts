import { useEffect, useState } from "react";

/** Becomes true after `delayMs` while mounted. */
export function useDelayedFlag(delayMs: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return flag;
}
