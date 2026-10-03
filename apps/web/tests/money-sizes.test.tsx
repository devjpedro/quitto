import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "@/components/ui/money";

describe("Money sizes", () => {
  it("card: 34 px, R$ and cents set back, the whole value read aloud", () => {
    const { container } = render(<Money cents={4_800_000} size="card" />);
    expect(container.firstElementChild).toHaveClass(
      "text-[34px]",
      "font-display",
      "tabular-nums"
    );
    expect(screen.getByText("R$ 48.000,00")).toHaveClass("sr-only");
  });

  it("milestone 24 px and list 17 px", () => {
    const milestone = render(<Money cents={554_000} size="milestone" />);
    expect(milestone.container.firstElementChild).toHaveClass("text-2xl");
    const list = render(<Money cents={32_000} size="list" />);
    expect(list.container.firstElementChild).toHaveClass("text-[17px]");
  });

  it("list with a sign: inside the small R$, and read aloud", () => {
    const { container } = render(<Money cents={32_000} sign="+" size="list" />);
    expect(screen.getByText("+ R$ 320,00")).toHaveClass("sr-only");
    expect(container.querySelector("[aria-hidden] > span")).toHaveTextContent(
      "+ R$"
    );
  });

  it("inline stays plain text", () => {
    render(<Money cents={230_000} />);
    expect(screen.getByText("R$ 2.300,00")).toBeVisible();
  });
});
