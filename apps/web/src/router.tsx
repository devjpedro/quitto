import {
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import {
  contractQueryOptions,
  contractsQueryOptions,
} from "./hooks/use-contracts";
import { dashboardQueryOptions } from "./hooks/use-dashboard";
import { notificationsQueryOptions } from "./hooks/use-notifications";
import { queryClient } from "./lib/query";
import { LoginPage } from "./routes/login";
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
  loader: () => queryClient.ensureQueryData(dashboardQueryOptions),
  component: lazyRouteComponent(
    () => import("./routes/dashboard"),
    "DashboardPage"
  ),
});

const contractsListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts",
  loader: () => queryClient.ensureQueryData(contractsQueryOptions),
  component: lazyRouteComponent(
    () => import("./routes/contracts-list"),
    "ContractsListPage"
  ),
});

const contractNewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/contracts/new",
  component: lazyRouteComponent(
    () => import("./routes/contract-new"),
    "ContractNewPage"
  ),
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
  component: lazyRouteComponent(
    () => import("./routes/contract-detail"),
    "ContractDetailPage"
  ),
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/notifications",
  loader: () => queryClient.ensureQueryData(notificationsQueryOptions),
  component: lazyRouteComponent(
    () => import("./routes/notifications"),
    "NotificationsPage"
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: lazyRouteComponent(
    () => import("./routes/settings"),
    "SettingsPage"
  ),
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/invites/$token",
  component: lazyRouteComponent(
    () => import("./routes/accept-invite"),
    "AcceptInvitePage"
  ),
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
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
