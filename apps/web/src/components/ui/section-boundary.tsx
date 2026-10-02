import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { m } from "@/paraglide/messages.js";

const SLOW_AFTER_MS = 3000;

function SlowFallback({
  children,
  slowAfterMs,
}: {
  children: ReactNode;
  slowAfterMs: number;
}) {
  const slow = useDelayedFlag(slowAfterMs);
  return (
    <div>
      {children}
      {/* Always mounted, filled later: a live region that appears already
          containing its text is not reliably announced. */}
      <p className="mt-2 text-ink-muted text-sm" role="status">
        {slow ? m.section_slow() : null}
      </p>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-card border border-line p-4"
      role="alert"
    >
      <p className="text-ink-muted text-sm">{m.section_error()}</p>
      <Button onClick={onRetry} size="sm" variant="secondary">
        {m.section_retry()}
      </Button>
    </div>
  );
}

/**
 * One loading/error unit of a page: the shell never blocks on data. Shows
 * the section's own skeleton, a notice when the API is slow (cold start),
 * and an inline retry on failure.
 */
export function SectionBoundary({
  children,
  fallback,
  slowAfterMs = SLOW_AFTER_MS,
}: {
  children: ReactNode;
  fallback: ReactNode;
  slowAfterMs?: number;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          fallbackRender={({ resetErrorBoundary }) => (
            <SectionError onRetry={resetErrorBoundary} />
          )}
          onReset={reset}
        >
          <Suspense
            fallback={
              <SlowFallback slowAfterMs={slowAfterMs}>{fallback}</SlowFallback>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
