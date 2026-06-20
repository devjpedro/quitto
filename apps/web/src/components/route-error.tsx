import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";

// Loader/beforeLoad errors (e.g. cold start that exhausted retries) land here
// via the router — not through the render-level ErrorBoundary. Prevents white screen.
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display font-semibold text-foreground text-lg">
        Ops, algo deu errado
      </p>
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <Button onClick={() => reset()} type="button">
        Tentar de novo
      </Button>
    </div>
  );
}
