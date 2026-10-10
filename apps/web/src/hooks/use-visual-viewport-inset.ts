import { useSyncExternalStore } from "react";

/** Below this, the visual viewport moved for something else (the URL bar), not the keyboard. */
export const KEYBOARD_MIN_PX = 120;

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) {
    return () => undefined;
  }
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

function snapshot(): number {
  const viewport = window.visualViewport;
  if (!viewport) {
    return 0;
  }
  return Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );
}

/**
 * How much of the layout viewport the on-screen keyboard covers (planner's
 * decision 33): the wizard's action bar rises by it and the summary turns
 * into one line. 0 on the server and without a keyboard.
 */
export function useVisualViewportInset(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
