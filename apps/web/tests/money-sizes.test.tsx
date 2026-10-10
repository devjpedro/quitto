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
    const [currency, centsPart] = container.querySelectorAll(
      "[aria-hidden] > span"
    );
    expect(currency).toHaveTextContent("R$");
    expect(currency).toHaveClass("text-[13px]", "align-top");
    expect(centsPart).toHaveTextContent(",00");
    expect(centsPart).toHaveClass("text-[0.56em]");
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

  it("a sign never doubles: with one, a negative amount reads as its size", () => {
    const list = render(<Money cents={-32_000} sign="−" size="list" />);
    expect(screen.getByText("− R$ 320,00")).toHaveClass("sr-only");
    expect(list.container.querySelector("[aria-hidden]")?.textContent).toBe(
      "− R$320,00"
    );
    list.unmount();
    render(<Money cents={-32_000} sign="−" />);
    expect(screen.getByText("− R$ 320,00")).toBeVisible();
  });

  it("inline stays plain text, with the sign when there is one", () => {
    render(<Money cents={230_000} />);
    expect(screen.getByText("R$ 2.300,00")).toBeVisible();
    render(<Money cents={32_000} sign="+" />);
    expect(screen.getByText("+ R$ 320,00")).toBeVisible();
  });

  it("summary: 22 px, R$ em 11 (o resumo do celular no wizard)", () => {
    const { container } = render(<Money cents={600_000} size="summary" />);
    expect(container.firstElementChild).toHaveClass("text-[22px]");
    expect(container.querySelector("[aria-hidden] > span")).toHaveClass(
      "text-[11px]"
    );
  });
});
