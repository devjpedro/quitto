import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const filled = {
  toPayCents: 150_000,
  toReceiveCents: 0,
  overdueCount: 1,
  overdueCents: 50_000,
  activeContractsCount: 2,
  completedContractsCount: 0,
  upcoming: [
    {
      id: "i1",
      contractId: "c1",
      contractTitle: "Aluguel",
      sequence: 3,
      amountCents: 50_000,
      dueDate: "2026-06-01",
      direction: "pay",
      isOverdue: true,
    },
  ],
};

const empty = {
  toPayCents: 0,
  toReceiveCents: 0,
  overdueCount: 0,
  overdueCents: 0,
  activeContractsCount: 0,
  completedContractsCount: 0,
  upcoming: [],
};

const ALUGUEL_RE = /aluguel/i;
const CRIAR_CONTRATO_RE = /criar contrato/i;
const UPCOMING_ARIA_RE = /^Aluguel, a pagar R\$\s?500,00, vencida$/;

const mockData: { data: typeof filled; isPending: boolean } = {
  data: filled,
  isPending: false,
};
vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardQuery: () => mockData,
}));

import { DashboardPage } from "../src/routes/dashboard";

describe("DashboardPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockData.data = filled;
    mockData.isPending = false;
  });

  it("renders the stat values and the upcoming list", () => {
    render(<DashboardPage />);
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("deep-links to the installment when an upcoming item is clicked", async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByRole("button", { name: ALUGUEL_RE }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });

  it("exposes an aria-label with title, direction, amount and overdue on upcoming rows", () => {
    render(<DashboardPage />);
    const button = screen.getByRole("button", { name: ALUGUEL_RE });
    expect(button).toHaveAttribute(
      "aria-label",
      expect.stringMatching(UPCOMING_ARIA_RE)
    );
  });

  it("shows the empty state with a CTA when there are no contracts", () => {
    mockData.data = empty;
    render(<DashboardPage />);
    expect(screen.getByText(CRIAR_CONTRATO_RE)).toBeInTheDocument();
  });
});
