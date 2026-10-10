import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Emphasis } from "@/components/ui/emphasis";

describe("Emphasis", () => {
  it("põe em negrito o pedaço que já está na frase", () => {
    const { container } = render(
      <Emphasis strong="quem paga" text="Você entra como quem paga." />
    );
    expect(container).toHaveTextContent("Você entra como quem paga.");
    expect(screen.getByText("quem paga").tagName).toBe("B");
  });

  it("sem o pedaço na frase, só o texto", () => {
    const { container } = render(
      <Emphasis strong="who pays" text="Você entra como quem paga." />
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent("Você entra como quem paga.");
  });
});
