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
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <main className="flex-1 pb-16 sm:pb-0" id="conteudo" tabIndex={-1}>
        <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[pathname]}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: ({ location }) => requireSession(queryClient, location.href),
  component: ProtectedLayout,
});
