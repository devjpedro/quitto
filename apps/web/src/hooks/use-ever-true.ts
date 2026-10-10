import { useState } from "react";

/**
 * `true` from the first render in which `flag` was true, and for good: it
 * mounts what lazy-loads on first use (the palette, the bell's panel) and
 * keeps it mounted, so the exit animation still plays.
 */
export function useEverTrue(flag: boolean): boolean {
  const [seen, setSeen] = useState(flag);
  if (flag && !seen) {
    setSeen(true);
  }
  return seen;
}
