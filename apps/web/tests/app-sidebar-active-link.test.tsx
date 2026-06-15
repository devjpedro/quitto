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

// NOTE: unlike app-sidebar.test.tsx, this file keeps the REAL Link so its
// active-state logic runs inside a router context. Mocking Link (and dropping
// activeProps) is exactly what let the active-highlight regression slip through.
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

const CONTRATOS = /contratos/i;
const CONTA = /conta/i;

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

describe("AppSidebar active link", () => {
  it("adds the 'active' class to the current route's links (desktop + mobile)", async () => {
    renderSidebarAt("/contracts");
    const contractLinks = await screen.findAllByRole("link", {
      name: CONTRATOS,
    });
    expect(contractLinks.length).toBeGreaterThan(0);
    for (const link of contractLinks) {
      expect(link.classList.contains("active")).toBe(true);
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("leaves non-current routes without the 'active' class", async () => {
    renderSidebarAt("/contracts");
    const settingsLinks = await screen.findAllByRole("link", { name: CONTA });
    expect(settingsLinks.length).toBeGreaterThan(0);
    for (const link of settingsLinks) {
      expect(link.classList.contains("active")).toBe(false);
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
