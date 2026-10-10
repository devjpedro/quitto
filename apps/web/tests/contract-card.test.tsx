import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ContractCard } from "@/features/contracts/components/contract-card";
import { listItem } from "./contracts-fixtures";
import { renderWithProviders } from "./test-utils";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/c">{children}</a>,
}));

const TODAY = "2026-10-08";

describe("ContractCard (B4)", () => {
  it("título, pessoa, %, 'falta R$ X' com a seta da direção, barra e a parcela da vez; sem células e sem a tag de direção", () => {
    renderWithProviders(
      <ContractCard
        item={listItem({ direction: "receive", remainingCents: 384_000 })}
        today={TODAY}
      />
    );
    const card = screen.getByRole("link");
    expect(within(card).getByRole("heading")).toBeVisible();
    expect(within(card).getByText("falta")).toBeVisible();
    expect(within(card).getByText("R$ 3.840,00")).toBeInTheDocument();
    // The direction is the arrow (and a word for the screen reader), not a tag.
    expect(card.querySelector("svg[data-direction='receive']")).not.toBeNull();
    expect(within(card).getByText("Você recebe.")).toHaveClass("sr-only");
    expect(within(card).queryByText("Parcelas")).toBeNull();
    expect(within(card).queryByText("Mensal")).toBeNull();
    expect(within(card).queryByText("Falta")).toBeNull();
  });

  it("a seta segue a direção: recebo ↙, pago ↗, e quem só acompanha não tem seta", () => {
    const arrows = (direction: "receive" | "pay" | null) => {
      const { container, unmount } = renderWithProviders(
        <ContractCard item={listItem({ direction })} today={TODAY} />
      );
      const found = Array.from(
        container.querySelectorAll("svg[data-direction]")
      ).map((svg) => svg.getAttribute("data-direction"));
      unmount();
      return found;
    };
    expect(arrows("receive")).toEqual(["receive"]);
    expect(arrows("pay")).toEqual(["pay"]);
    expect(arrows(null)).toEqual([]);
  });

  it("quem só acompanha não tem seta: fica a tag 'Você acompanha'", () => {
    renderWithProviders(
      <ContractCard item={listItem({ direction: null })} today={TODAY} />
    );
    expect(screen.getByText("Você acompanha")).toBeVisible();
    expect(screen.queryByText("Você recebe.")).toBeNull();
  });
});
