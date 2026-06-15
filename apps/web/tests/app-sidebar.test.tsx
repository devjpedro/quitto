import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    activeProps: _activeProps,
    ...props
  }: {
    children: React.ReactNode;
    activeProps?: Record<string, unknown>;
  }) => <a {...props}>{children}</a>,
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({
    data: { id: "u1", name: "Test", email: "t@e.com", image: null },
  }),
}));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="bell" />,
}));
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: vi.fn(() => ({ data: { count: 0 } })),
}));

import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { AppSidebar } from "../src/components/app-sidebar";

const NAV_LABEL = /Navegação principal/i;

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.mocked(useUnreadCountQuery).mockReturnValue({
      data: { count: 0 },
    } as unknown as ReturnType<typeof useUnreadCountQuery>);
  });

  it("renders Dashboard and Contratos nav items", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Contratos").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Notificações nav item", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Notificações").length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("shows the user name from useMeQuery in the footer", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("labels both navigation landmarks (desktop + mobile) as 'Navegação principal'", () => {
    render(<AppSidebar />);
    expect(screen.getAllByRole("navigation", { name: NAV_LABEL })).toHaveLength(
      2
    );
  });

  it("shows the unread badge on Notificações when count > 0", () => {
    vi.mocked(useUnreadCountQuery).mockReturnValue({
      data: { count: 3 },
    } as unknown as ReturnType<typeof useUnreadCountQuery>);
    render(<AppSidebar />);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("pins the desktop sidebar to the viewport (sticky, full height)", () => {
    const { container } = render(<AppSidebar />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    // Guards the fixed-sidebar layout: without these the footer only shows
    // after scrolling to the bottom of long content.
    expect(aside).toHaveClass("sticky", "top-0", "h-screen");
  });
});
