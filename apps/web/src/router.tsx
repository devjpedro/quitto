// First: the locale strategy is in place before anything renders.
import "./lib/ssr-locale";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { PagePending } from "./components/layout/page-pending";
import { NotFound } from "./components/not-found";
import { RouteError } from "./components/route-error";
import { makeQueryClient } from "./lib/query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = makeQueryClient(); // fresh por request (SSR)
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    // From md the white panel is what scrolls (ShellFrame), not the page.
    scrollToTopSelectors: ["#conteudo"],
    defaultErrorComponent: RouteError,
    // Fallback do <Suspense> de cada rota: sem ele uma rota que suspende (chunk
    // ainda baixando) cai no Suspense do Outlet raiz com `null` → tela vazia.
    // Por rota, o fallback fica contido no <main> e o shell (sidebar/abas) continua.
    defaultPendingComponent: PagePending,
    defaultNotFoundComponent: NotFound,
    context: { queryClient },
  });
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: true,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
