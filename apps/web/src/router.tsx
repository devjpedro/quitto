import { createRoute, createRouter } from "@tanstack/react-router";
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([dashboardRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
