import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { Button } from "@/components/ui/button";
import { reloadOnceForChunkError } from "@/lib/chunk-reload";
import { errorMessage } from "@/lib/error-message";

// Loader/beforeLoad errors (e.g. cold start that exhausted retries) land here
// via the router — not through the render-level ErrorBoundary. Prevents white screen.
export function RouteError({ error, reset }: ErrorComponentProps) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    // Chunk stale pós-deploy: recarrega uma vez (busca o index/HTML novo).
    const didReload = reloadOnceForChunkError(error, sessionStorage, () =>
      window.location.reload()
    );
    if (didReload) {
      setReloading(true);
    }
  }, [error]);

  if (reloading) {
    return <BrandLoader label="Atualizando…" />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-semibold text-foreground text-lg">
        Ops, algo deu errado
      </p>
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <Button onClick={() => reset()} type="button">
        Tentar de novo
      </Button>
    </div>
  );
}
