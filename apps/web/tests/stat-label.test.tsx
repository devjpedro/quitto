import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatLabel } from "@/components/stat-label";

describe("StatLabel", () => {
  it("renderiza o texto na escala semântica (sem text-[0.7rem] arbitrário)", () => {
    render(<StatLabel>Total</StatLabel>);
    const el = screen.getByText("Total");
    expect(el).toHaveClass("text-xs");
    expect(el.className).not.toContain("0.7rem");
  });
});
