import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";
import { reloadOnceForChunkError } from "@/lib/chunk-reload";

const loadFeatures = () =>
  import("@/lib/motion-features")
    .then((mod) => mod.default)
    .catch((error: unknown) => {
      reloadOnceForChunkError(error, sessionStorage, () =>
        window.location.reload()
      );
      throw error;
    });

/** How long after the page is up the browser may fetch what the user has not asked for yet. */
const PREFETCH_DELAY_MS = 2500;

/** Runs `task` once the page has loaded and a beat has passed, so it never competes with the first paint. */
export function prefetchWhenIdle(task: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    timer = setTimeout(task, PREFETCH_DELAY_MS);
  };
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
  return () => {
    window.removeEventListener("load", start);
    clearTimeout(timer);
  };
}

/**
 * Fetches a chunk ahead. A warm-up that fails is not an error: a tab from
 * before a deploy asks for a chunk the new one no longer has, and the real use
 * loads it again (RouteError then reloads the page once).
 */
export function warmChunk(load: () => Promise<unknown>): void {
  load().catch(() => undefined);
}

/** Fetches the animation engine ahead, so the first sheet opens animated. */
export function warmMotion(): void {
  warmChunk(loadFeatures);
}

/** The `m.*` inside animate as soon as the engine is there; until then they stay at `initial`. */
export function MotionScope({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
