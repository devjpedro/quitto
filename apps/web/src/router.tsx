import { createRoute, createRouter } from "@tanstack/react-router";
import {
  contractQueryOptions,
  contractsQueryOptions,
} from "./hooks/use-contracts";
import { notificationsQueryOptions } from "./hooks/use-notifications";
import { queryClient } from "./lib/query";
import { AcceptInvitePage } from "./routes/accept-invite";
import { ContractDetailPage } from "./routes/contract-detail";
import { ContractNewPage } from "./routes/contract-new";
import { ContractsListPage } from "./routes/contracts-list";
import { DashboardPage } from "./routes/dashboard";
import { LoginPage } from "./routes/login";
import { NotificationsPage } from "./routes/notifications";
import { protectedRoute } from "./routes/protected";
import { rootRoute } from "./routes/root";

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
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
  validateSearch: (search: Record<string, unknown>) => ({
    installment:
      typeof search.installment === "string" ? search.installment : undefined,
  }),
  loader: ({ params }) =>
    queryClient.ensureQueryData(contractQueryOptions(params.id)),
  component: ContractDetailPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/notifications",
  loader: () => queryClient.ensureQueryData(notificationsQueryOptions),
  component: NotificationsPage,
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/invites/$token",
  component: AcceptInvitePage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    contractsListRoute,
    contractNewRoute,
    contractDetailRoute,
    acceptInviteRoute,
    notificationsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
