import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LOWER_COLUMN,
  LOWER_WITH_SIDE,
} from "@/features/home/components/home-grid";
import { HomeSkeleton } from "@/features/home/components/home-skeleton";

const classes = (value: string) => value.split(" ");

describe("HomeSkeleton", () => {
  it("a parte de baixo tem a grade do conteúdo: a lista à esquerda; marcos e Notificações recentes à direita a partir de lateral", () => {
    const { container } = render(<HomeSkeleton />);
    const lower = container.querySelector<HTMLElement>(
      "[class~='lateral:grid']"
    );
    expect(lower).toHaveClass(...classes(LOWER_WITH_SIDE));
    const [list, side] = Array.from(lower?.children ?? []);
    expect(list).toHaveClass(...classes(LOWER_COLUMN));
    // From wide each side block takes a column of its own, as in the content.
    expect(side).toHaveClass(...classes(LOWER_COLUMN), "wide:contents");
    // "Próximos 30 dias" at any width: its section title and one filled block.
    expect(list?.firstElementChild?.children).toHaveLength(2);
    expect(list?.firstElementChild?.lastElementChild).toHaveClass(
      "h-48",
      "bg-surface-card"
    );
    // The side blocks only from lateral, like the content's.
    const [milestones, recent] = Array.from(side?.children ?? []);
    expect(milestones).toHaveClass("hidden", "lateral:flex");
    expect(recent).toHaveClass("hidden", "lateral:flex");
    // "Notificações recentes" with its own loading rows: 4 on the raised surface.
    const rows = recent?.querySelector("ul");
    expect(rows).toHaveClass("bg-surface-raised");
    expect(rows?.children).toHaveLength(4);
  });

  it("os ossos de cartão e de lista são preenchidos como o que vai chegar (brancos no celular)", () => {
    const { container } = render(<HomeSkeleton />);
    const bones = [
      ...container.querySelectorAll<HTMLElement>("[aria-hidden='true']"),
    ];
    expect(
      bones.some(
        (bone) =>
          bone.classList.contains("h-60") &&
          bone.classList.contains("bg-surface-card")
      )
    ).toBe(true);
    expect(
      bones.some(
        (bone) =>
          bone.classList.contains("h-48") &&
          bone.classList.contains("bg-surface-card")
      )
    ).toBe(true);
  });
});
