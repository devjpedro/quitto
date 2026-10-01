import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { BrandLoader } from "./components/brand-loader";
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
    defaultErrorComponent: RouteError,
    // Fallback do <Suspense> de cada rota: sem ele uma rota que suspende (chunk
    // ainda baixando) cai no Suspense do Outlet raiz com `null` → tela vazia.
    // Por rota, a suspensão fica contida no <main> e a sidebar continua.
    defaultPendingComponent: BrandLoader,
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
