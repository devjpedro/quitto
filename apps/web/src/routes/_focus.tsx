import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { useIdentity } from "@/hooks/use-identity";
import { useSessionGate } from "@/hooks/use-session-gate";
import { seedSession } from "@/lib/session-route";

/**
 * Focus mode (owner's decision 1): signed in, outside the shell; the page
 * draws its own frame (StepFrame). No ⌘K and no notifications panel.
 */
export const Route = createFileRoute("/_focus")({
  beforeLoad: async ({ context, location }) => {
    const status = await seedSession(context.queryClient);
    if (status === "anon") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: FocusLayout,
});

function FocusLayout() {
  useSessionGate();
  const identity = useIdentity();
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[identity?.id]}>
      <Outlet />
    </ErrorBoundary>
  );
}
