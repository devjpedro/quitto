import type { FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";

/** Route-level error boundary fallback. Friendly message + retry (resets the boundary). */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display font-semibold text-foreground text-lg">
        Ops, algo deu errado
      </p>
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <Button onClick={resetErrorBoundary} type="button">
        Tentar de novo
      </Button>
    </div>
  );
}
