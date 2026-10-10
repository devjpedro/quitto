import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionTitle } from "@/components/ui/section-title";

describe("SectionTitle", () => {
  it("Bricolage 19/600 em ink, nunca ink-muted", () => {
    render(<SectionTitle id="t">Próximos 30 dias</SectionTitle>);
    const title = screen.getByRole("heading", {
      name: "Próximos 30 dias",
      level: 2,
    });
    expect(title).toHaveClass(
      "font-display",
      "text-[19px]",
      "font-semibold",
      "text-ink"
    );
    expect(title).not.toHaveClass("text-ink-muted");
  });

  it("o aux fica à direita, em 13 px ink-muted; o título com −0,02 em", () => {
    render(
      <SectionTitle aux="5 parcelas" id="t">
        Próximos 30 dias
      </SectionTitle>
    );
    const title = screen.getByRole("heading", { name: "Próximos 30 dias" });
    expect(title).toHaveClass("tracking-[-0.02em]");
    const aux = screen.getByText("5 parcelas");
    expect(aux).toBeVisible();
    expect(aux).toHaveClass("text-[13px]", "text-ink-muted", "tabular-nums");
    // Beside the title, not inside it: the heading's name stays the title alone.
    expect(title).not.toContainElement(aux);
    expect(aux.parentElement).toBe(title.parentElement);
    expect(title.parentElement).toHaveClass("justify-between");
  });
});
