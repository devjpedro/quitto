import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Test" } } }),
  signOut: vi.fn(),
}));

import { AppSidebar } from "../src/components/app-sidebar";

describe("AppSidebar", () => {
  it("renders Dashboard and Contratos nav items", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Contratos").length).toBeGreaterThanOrEqual(1);
  });
});
