import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({ data: { id: "u1", name: "Maria", email: "m@e.com" } }),
}));
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: () => ({ data: { count: 0 } }),
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => null,
}));

import { AppSidebar } from "../src/components/app-sidebar";

function renderSidebarAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AppSidebar />
        <Outlet />
      </>
    ),
  });
  rootRoute.addChildren(
    ["/", "/contracts", "/notifications", "/settings"].map((p) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path: p,
        component: () => null,
      })
    )
  );
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("AppSidebar brand logo", () => {
  it("renders the logo as a link to home", async () => {
    renderSidebarAt("/contracts");
    const home = await screen.findByRole("link", { name: "Ir para o início" });
    expect(home).toHaveAttribute("href", "/");
  });

  it("shows the Quitto wordmark inside that link", async () => {
    renderSidebarAt("/contracts");
    expect(
      await screen.findByRole("img", { name: "Quitto" })
    ).toBeInTheDocument();
  });
});
