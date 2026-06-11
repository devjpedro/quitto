import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const useContractQuery = vi.fn();
vi.mock("../src/hooks/use-contracts", () => ({
  useContractQuery: () => useContractQuery(),
}));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ id: "c1" }) }));

import { ContractDetailPage } from "../src/routes/contract-detail";

const REMAINING_BRL = /R\$\s?74\.400,00/;
const INSTALLMENT_BRL = /R\$\s?2\.000,00/;

const detail = {
  role: "owner",
  contract: {
    id: "c1",
    title: "Apê do irmão",
    description: null,
    ownerRole: "buyer",
    requiresConfirmation: true,
    status: "active",
  },
  progress: {
    totalCents: 12_000_000,
    paidCents: 4_560_000,
    remainingCents: 7_440_000,
    percent: 38,
    overdueCount: 2,
  },
  installments: [
    {
      id: "i1",
      sequence: 1,
      amountCents: 200_000,
      dueDate: "2026-07-10",
      status: "paid",
    },
    {
      id: "i2",
      sequence: 2,
      amountCents: 200_000,
      dueDate: "2026-08-10",
      status: "pending",
    },
  ],
  participants: [
    { id: "p1", displayName: "Você", role: "owner", linked: true },
  ],
};

describe("ContractDetailPage", () => {
  beforeEach(() => useContractQuery.mockReset());

  it("renders stats and installments from the query data", () => {
    useContractQuery.mockReturnValue({ data: detail, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByText("Apê do irmão")).toBeInTheDocument();
    expect(screen.getByText(REMAINING_BRL)).toBeInTheDocument();
    expect(screen.getAllByText(INSTALLMENT_BRL).length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("shows a skeleton while pending", () => {
    useContractQuery.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderWithProviders(<ContractDetailPage />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
