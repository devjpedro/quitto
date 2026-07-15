import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "@/components/money";

describe("Money", () => {
  it("renderiza o valor completo e recua símbolo/centavos", () => {
    const { container } = render(<Money cents={200_000} />);
    expect(container.textContent).toBe("R$2.000,00");
    expect(screen.getByText("2.000")).toBeInTheDocument();
    expect(container.querySelector(".tabular-nums")).not.toBeNull();
  });
});
