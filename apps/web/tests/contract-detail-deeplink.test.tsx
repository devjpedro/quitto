import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const CLOSE_BUTTON = /fechar/i;
const DEEP_LINK = { installment: "i1" };
/** The route's search on the next render (a test swaps it to rerender). */
let currentSearch: { installment?: string; status?: string } = DEEP_LINK;

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "c1" }),
  useSearch: () => currentSearch,
  useNavigate: () => navigate,
}));

vi.mock("@/components/installment-drawer", () => ({
  InstallmentDrawer: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="installment-drawer">
        <button onClick={onClose} type="button">
          Fechar
        </button>
      </div>
    ) : null,
}));
vi.mock("@/components/participants-drawer", () => ({
  ParticipantsDrawer: () => null,
}));
vi.mock("@/components/contract-actions-menu", () => ({
  ContractActionsMenu: () => null,
}));
vi.mock("@/components/contract-pix-key-form", () => ({
  ContractPixKeyForm: () => null,
}));

vi.mock("@/hooks/use-contracts", () => ({
  useContractQuery: () => ({
    isPending: false,
    data: {
      role: "buyer",
      isOwner: true,
      isPayer: true,
      isApprover: false,
      contract: {
        id: "c1",
        title: "Contrato",
        status: "active",
        ownerRole: "buyer",
        requiresConfirmation: false,
      },
      progress: {
        overdueCount: 0,
        paidCount: 0,
        totalCount: 1,
        percent: 0,
        totalCents: 0,
        paidCents: 0,
        remainingCents: 0,
      },
      participants: [],
      // One overdue, one paid, one ahead: each filter shows a different list.
      installments: [
        {
          id: "i1",
          sequence: 1,
          amountCents: 1000,
          dueDate: "2020-07-10",
          status: "pending",
        },
        {
          id: "i2",
          sequence: 2,
          amountCents: 1000,
          dueDate: "2020-08-10",
          status: "paid",
        },
        {
          id: "i3",
          sequence: 3,
          amountCents: 1000,
          dueDate: "2099-09-10",
          status: "pending",
        },
      ],
    },
  }),
}));

import { ContractDetailPage } from "../src/features/contracts/contract-detail-page";

describe("contract-detail deep-link", () => {
  beforeEach(() => {
    navigate.mockClear();
    currentSearch = DEEP_LINK;
  });

  it("opens the installment drawer when ?installment matches", () => {
    render(<ContractDetailPage />);
    expect(screen.getByTestId("installment-drawer")).toBeInTheDocument();
  });

  it("clears the ?installment param when the drawer closes, keeping the filter", async () => {
    render(<ContractDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: CLOSE_BUTTON }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/contracts/$id",
        params: { id: "c1" },
        replace: true,
      })
    );
    const options = navigate.mock.calls[0]?.[0] as
      | { search: (prev: Record<string, unknown>) => Record<string, unknown> }
      | undefined;
    expect(options?.search({ installment: "i1", status: "overdue" })).toEqual({
      installment: undefined,
      status: "overdue",
    });
  });

  it("opens the list on ?status= and a new ?status= on the mounted page switches it", () => {
    currentSearch = { status: "overdue" };
    const { rerender } = render(<ContractDetailPage />);
    expect(
      screen.getByRole("button", { name: "Atrasadas (1)" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("installment-row-i1")).toBeVisible();
    expect(screen.queryByTestId("installment-row-i2")).toBeNull();

    // The router keeps the page mounted when only the search changes (the
    // bell opening a group of this same contract).
    currentSearch = { status: "paid" };
    rerender(<ContractDetailPage />);
    expect(screen.getByRole("button", { name: "Pagas (1)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("installment-row-i2")).toBeVisible();
    expect(screen.queryByTestId("installment-row-i1")).toBeNull();
  });

  it("closing the drawer (only ?installment changes) keeps the chip picked by hand", async () => {
    currentSearch = { installment: "i1", status: "overdue" };
    const { rerender } = render(<ContractDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: "Pagas (1)" }));

    currentSearch = { status: "overdue" };
    rerender(<ContractDetailPage />);
    expect(screen.getByRole("button", { name: "Pagas (1)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
