import { createRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorFallback } from "@/components/error-fallback";
import { queryClient } from "@/lib/query";
import { requireSession } from "@/lib/require-session";
import { rootRoute } from "./root";

function ProtectedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 pb-16 sm:pb-0">
        <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[pathname]}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: ({ location }) => requireSession(queryClient, location.href),
  component: ProtectedLayout,
});
