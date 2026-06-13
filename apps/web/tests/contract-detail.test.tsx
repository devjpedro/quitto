import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const useContractQuery = vi.fn();
vi.mock("../src/hooks/use-contracts", () => ({
  useContractQuery: () => useContractQuery(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ id: "c1" }),
  useSearch: () => ({ installment: undefined }),
}));

import { ContractDetailPage } from "../src/routes/contract-detail";

const REMAINING_BRL = /R\$\s?74\.400,00/;
const INSTALLMENT_BRL = /R\$\s?2\.000,00/;
const MANAGE_BUTTON = /gerenciar/i;

const detail = {
  role: "buyer",
  isOwner: true,
  isPayer: true,
  isApprover: true,
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
    {
      id: "p1",
      displayName: "Você",
      role: "buyer",
      linked: true,
      isOwner: true,
    },
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

  it("mostra o botão Gerenciar para o dono", () => {
    useContractQuery.mockReturnValue({ data: detail, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    expect(
      screen.getByRole("button", { name: MANAGE_BUTTON })
    ).toBeInTheDocument();
  });

  it("não mostra Gerenciar para não-dono", () => {
    useContractQuery.mockReturnValue({
      data: {
        ...detail,
        role: "viewer",
        isOwner: false,
        isPayer: false,
        isApprover: false,
      },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    expect(
      screen.queryByRole("button", { name: MANAGE_BUTTON })
    ).not.toBeInTheDocument();
  });

  it("exibe o badge 'Dono' para o participante com isOwner=true", () => {
    useContractQuery.mockReturnValue({ data: detail, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    // header badge + participants list badge — ambos rendem "Dono"
    expect(screen.getAllByText("Dono").length).toBeGreaterThanOrEqual(2);
  });

  it("não exibe o badge 'Dono' para participante sem isOwner", () => {
    const detailNoOwner = {
      ...detail,
      isOwner: false,
      participants: [
        {
          id: "p1",
          displayName: "Você",
          role: "owner",
          linked: true,
          isOwner: false,
        },
      ],
    };
    useContractQuery.mockReturnValue({ data: detailNoOwner, isPending: false });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.queryByText("Dono")).not.toBeInTheDocument();
  });

  it("shows a skeleton while pending", () => {
    useContractQuery.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderWithProviders(<ContractDetailPage />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("mostra o papel do usuário logado na badge (vendedor)", () => {
    useContractQuery.mockReturnValue({
      data: { ...detail, role: "seller", isOwner: false },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByText("vendedor")).toBeInTheDocument();
  });

  it("mostra papel + tag Dono no header quando isOwner", () => {
    useContractQuery.mockReturnValue({
      data: { ...detail, role: "buyer", isOwner: true },
      isPending: false,
    });
    renderWithProviders(<ContractDetailPage />);
    // "comprador" aparece no header e na lista de participantes (fixture base tem buyer)
    expect(screen.getAllByText("comprador").length).toBeGreaterThanOrEqual(1);
    // "Dono" aparece no header e na lista de participantes; basta existir >=2
    expect(screen.getAllByText("Dono").length).toBeGreaterThanOrEqual(2);
  });
});
