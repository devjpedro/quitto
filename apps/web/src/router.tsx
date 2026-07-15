import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { makeQueryClient } from "./lib/query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = makeQueryClient(); // fresh por request (SSR)
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    context: { queryClient },
  });
  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: true });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
