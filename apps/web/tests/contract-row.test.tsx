import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...p }: { children: ReactNode }) => (
    <a {...p}>{children}</a>
  ),
}));

import { ContractRow } from "../src/components/contract-row";

const TOTAL = /R\$\s?120\.000,00/;
const OVERDUE = /2 atrasadas/i;
const EM_DIA = /em dia/i;

const item = {
  id: "c1",
  title: "Apê do irmão",
  ownerRole: "buyer",
  status: "active",
  totalCents: 12_000_000,
  paidCents: 4_560_000,
  percent: 38,
  overdueCount: 2,
  installmentsCount: 60,
};

describe("ContractRow", () => {
  it("shows title, formatted paid/total and overdue badge", () => {
    render(<ContractRow contract={item} />);
    expect(screen.getByText("Apê do irmão")).toBeInTheDocument();
    expect(screen.getByText(TOTAL)).toBeInTheDocument();
    expect(screen.getByText(OVERDUE)).toBeInTheDocument();
    expect(screen.getByText("ativo")).toBeInTheDocument();
  });

  it("shows 'em dia' when there are no overdue installments", () => {
    render(<ContractRow contract={{ ...item, overdueCount: 0 }} />);
    expect(screen.getByText(EM_DIA)).toBeInTheDocument();
  });
});
