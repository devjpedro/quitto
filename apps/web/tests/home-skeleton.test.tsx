import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeSkeleton } from "@/features/home/components/home-skeleton";

describe("HomeSkeleton", () => {
  it("tem a grade do conteúdo: ação e 'Na sequência', depois 'Próximos 30 dias' e 'Marcos', em duas colunas a partir de lateral", () => {
    const { container } = render(<HomeSkeleton />);
    const grid = container.querySelector<HTMLElement>(
      "[class~='lateral:grid']"
    );
    expect(grid).toHaveClass("lateral:grid-cols-2", "gap-7");
    expect(grid?.children).toHaveLength(4);
    const [action, sequence, upcoming, milestones] = Array.from(
      grid?.children ?? []
    );
    expect(action).toHaveClass("h-[320px]", "rounded-card", "bg-surface-card");
    expect(sequence).toHaveClass("rounded-card", "bg-surface-card");
    // Both lower blocks: the SectionTitle's 23.75 px line box and 12 px below it, then one block.
    for (const block of [upcoming, milestones]) {
      expect(block?.firstElementChild).toHaveClass("mb-3", "h-[23.75px]");
      expect(block?.lastElementChild).toHaveClass("bg-surface-card");
    }
  });

  it("a linha do subtítulo tem 20 px e sobe como a do conteúdo", () => {
    const { container } = render(<HomeSkeleton />);
    expect(container.querySelector(".-mt-2.h-5")).not.toBeNull();
  });

  it("no celular todo osso aparece: nenhum usa o surface-sunken, que é a cor da página ali", () => {
    const { container } = render(<HomeSkeleton />);
    const bones = [
      ...container.querySelectorAll<HTMLElement>("div[aria-hidden='true']"),
    ];
    expect(bones.length).toBeGreaterThan(5);
    for (const bone of bones) {
      expect(bone).toHaveClass("bg-surface-card");
      expect(bone).not.toHaveClass("bg-surface-sunken");
    }
  });
});
