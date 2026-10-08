import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: unknown }) => children,
  getRouteApi: () => ({ useSearch: () => ({}), useNavigate: () => vi.fn() }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));

import { ContractSkeleton } from "@/features/contracts/components/contract-skeleton";
import { ContractsSkeleton } from "@/features/contracts/components/contracts-skeleton";
import { InstallmentsSkeleton } from "@/features/installments/components/installments-skeleton";
import { PeopleSkeleton } from "@/features/people/components/people-skeleton";

describe("skeletons das páginas: a forma e a altura do que vai chegar", () => {
  it("Contratos: a barra (2 controles e os totais) e seis cartões de 275 px na grade dos cartões", () => {
    const { container } = render(<ContractsSkeleton />);
    const cards = container.querySelectorAll(".h-\\[275px\\]");
    expect(cards).toHaveLength(6);
    expect(cards[0]?.parentElement).toHaveClass("grid", "xl:grid-cols-3");
    expect(container.querySelectorAll(".h-\\[50px\\]")).toHaveLength(2);
  });

  it("Pessoas: seis cartões na grade; no celular cada um é uma linha de 109 px com rosto", () => {
    const { container } = render(<PeopleSkeleton />);
    const rows = container.querySelectorAll(".h-\\[109px\\]");
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveClass("md:hidden");
    expect(rows[0]?.querySelector(".rounded-full")).not.toBeNull();
    expect(container.querySelectorAll(".h-\\[193px\\]")).toHaveLength(6);
  });

  it("Parcelas: a mesma grade do conteúdo, com a coluna de 420 px de lateral em diante", () => {
    const { container } = render(<InstallmentsSkeleton />);
    expect(container.firstElementChild).toHaveClass(
      "lateral:grid",
      "lateral:grid-cols-[minmax(0,1fr)_420px]"
    );
    const aside = container.firstElementChild?.lastElementChild;
    expect(aside).toHaveClass("hidden", "lateral:block", "h-[258px]");
    // Three groups, each a title and a block.
    expect(container.querySelectorAll("[class*='h-[196px]']")).toHaveLength(1);
  });

  it("Contrato: o cartão da próxima ação (abaixo de lateral, entre o resumo e as abas) e a coluna de lateral", () => {
    const { container } = render(<ContractSkeleton />);
    expect(
      container.querySelector(".lateral\\:hidden.h-\\[222px\\]")
    ).not.toBeNull();
    const column = container.firstElementChild?.lastElementChild;
    expect(column).toHaveClass("hidden", "lateral:flex");
    expect(column?.firstElementChild).toHaveClass("h-[213px]");
  });
});
