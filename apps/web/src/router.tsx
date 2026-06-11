import { createRoute, createRouter } from "@tanstack/react-router";
import {
  contractQueryOptions,
  contractsQueryOptions,
} from "./hooks/use-contracts";
import { queryClient } from "./lib/query";
import { ContractDetailPage } from "./routes/contract-detail";
import { ContractNewPage } from "./routes/contract-new";
import { ContractsListPage } from "./routes/contracts-list";
import { DashboardPage } from "./routes/dashboard";
import { LoginPage } from "./routes/login";
import { protectedRoute } from "./routes/protected";
import { rootRoute } from "./routes/root";

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
});

const contractsListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts",
  loader: () => queryClient.ensureQueryData(contractsQueryOptions),
  component: ContractsListPage,
});

const contractNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/new",
  component: ContractNewPage,
});

const contractDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/$id",
  loader: ({ params }) =>
    queryClient.ensureQueryData(contractQueryOptions(params.id)),
  component: ContractDetailPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    contractsListRoute,
    contractNewRoute,
    contractDetailRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
