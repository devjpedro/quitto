import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const CLOSE_BUTTON = /fechar/i;

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "c1" }),
  useSearch: () => ({ installment: "i1" }),
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
      installments: [
        {
          id: "i1",
          sequence: 1,
          amountCents: 1000,
          dueDate: "2026-07-10",
          status: "pending",
        },
      ],
    },
  }),
}));

import { ContractDetailPage } from "../src/routes/contract-detail";

describe("contract-detail deep-link", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("opens the installment drawer when ?installment matches", () => {
    render(<ContractDetailPage />);
    expect(screen.getByTestId("installment-drawer")).toBeInTheDocument();
  });

  it("clears the ?installment param when the drawer closes", async () => {
    render(<ContractDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: CLOSE_BUTTON }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: undefined },
      replace: true,
    });
  });
});
