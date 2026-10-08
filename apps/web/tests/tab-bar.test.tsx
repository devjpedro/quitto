import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    "aria-label": ariaLabel,
    children,
    to,
    viewTransition,
  }: {
    "aria-label"?: string;
    children: ReactNode | ((state: { isActive: boolean }) => ReactNode);
    to: string;
    viewTransition?: { types: string[] };
  }) => (
    <a
      aria-label={ariaLabel}
      data-view-transition={viewTransition?.types.join(" ")}
      href={to}
    >
      {typeof children === "function"
        ? children({ isActive: false })
        : children}
    </a>
  ),
}));

import { TabBar } from "@/components/layout/tab-bar";

describe("TabBar", () => {
  it("o ＋ abre o wizard com a transição da folha (sheet-up)", () => {
    render(<TabBar />);
    const plus = screen.getByRole("link", { name: "Novo contrato" });
    expect(plus).toHaveAttribute("href", "/contracts/new");
    expect(plus).toHaveAttribute("data-view-transition", "sheet-up");
  });
});
