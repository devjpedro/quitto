import { WarningCircle } from "@phosphor-icons/react";
import type { FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { StateHeading } from "@/features/invites/components/state-heading";
import { errorMessage } from "@/lib/error-message";
import { m } from "@/paraglide/messages.js";

/** Route-level error boundary fallback, inside the shell's panel: the sentence and a retry (resets the boundary). */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-[476px]">
        <StateHeading
          icon={WarningCircle}
          title={m.app_error_title()}
          tone="warning"
        >
          {errorMessage(error)}
        </StateHeading>
        <Button className="mt-6" onClick={resetErrorBoundary} size="lg">
          {m.section_retry()}
        </Button>
      </div>
    </div>
  );
}
