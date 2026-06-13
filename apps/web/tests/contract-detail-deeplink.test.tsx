import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "c1" }),
  useSearch: () => ({ installment: "i1" }),
}));

vi.mock("@/components/installment-drawer", () => ({
  InstallmentDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="installment-drawer" /> : null,
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
  it("opens the installment drawer when ?installment matches", () => {
    render(<ContractDetailPage />);
    expect(screen.getByTestId("installment-drawer")).toBeInTheDocument();
  });
});
