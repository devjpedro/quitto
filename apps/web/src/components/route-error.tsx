import { WarningCircle } from "@phosphor-icons/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PagePending } from "@/components/layout/page-pending";
import { CenteredCard } from "@/components/not-found";
import { Button } from "@/components/ui/button";
import { StateHeading } from "@/features/invites/components/state-heading";
import { reloadOnceForChunkError } from "@/lib/chunk-reload";
import { errorMessage } from "@/lib/error-message";
import { m } from "@/paraglide/messages.js";

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
    return <PagePending />;
  }

  return (
    <CenteredCard>
      <StateHeading
        icon={WarningCircle}
        title={m.app_error_title()}
        tone="warning"
      >
        {errorMessage(error)}
      </StateHeading>
      <Button className="mt-6" onClick={() => reset()} size="lg">
        {m.section_retry()}
      </Button>
    </CenteredCard>
  );
}
