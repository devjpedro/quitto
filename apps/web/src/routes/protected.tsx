import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@/lib/auth-client";
import { rootRoute } from "./root";

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  ),
});
