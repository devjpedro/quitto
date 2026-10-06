import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { type ReactNode, Suspense, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { isTimeoutError } from "@/lib/with-timeout";
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

function SectionError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-card bg-surface-card p-4"
      role="alert"
    >
      <p className="text-ink-muted text-sm">
        {isTimeoutError(error) ? m.section_timeout() : m.section_error()}
      </p>
      <Button onClick={onRetry} size="sm" variant="inset">
        {m.section_retry()}
      </Button>
    </div>
  );
}

/**
 * One loading/error unit of a page: the shell never blocks on data. Shows the
 * section's own skeleton, a notice when the API is slow (cold start), and an
 * inline "Try again" when the request fails or times out. After a retry the
 * focus moves to the section, since the button that had it is gone.
 */
export function SectionBoundary({
  children,
  fallback,
  renderError,
  slowAfterMs = SLOW_AFTER_MS,
}: {
  children: ReactNode;
  fallback: ReactNode;
  /** A non-null result replaces the "Try again" (a 404 is not worth retrying). */
  renderError?: (error: unknown) => ReactNode | null;
  slowAfterMs?: number;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand"
      ref={regionRef}
      tabIndex={-1}
    >
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) =>
              renderError?.(error) ?? (
                <SectionError error={error} onRetry={resetErrorBoundary} />
              )
            }
            onReset={() => {
              reset();
              regionRef.current?.focus();
            }}
          >
            <Suspense
              fallback={
                <SlowFallback slowAfterMs={slowAfterMs}>
                  {fallback}
                </SlowFallback>
              }
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}
