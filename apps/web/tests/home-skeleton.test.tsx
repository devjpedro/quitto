import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LOWER_COLUMN,
  LOWER_STACK,
  LOWER_WITH_SIDE,
} from "@/features/home/components/home-grid";
import { HomeSkeleton } from "@/features/home/components/home-skeleton";

const classes = (value: string) => value.split(" ");

describe("HomeSkeleton", () => {
  it("a parte de baixo tem a grade do conteúdo: a lista à esquerda; os marcos à direita a partir de lateral", () => {
    const { container } = render(<HomeSkeleton />);
    const lower = container.querySelector<HTMLElement>(
      "[class~='lateral:grid']"
    );
    // The content's grid and rhythm, so nothing shifts when the home streams in.
    expect(lower).toHaveClass(
      ...classes(LOWER_STACK),
      ...classes(LOWER_WITH_SIDE)
    );
    const [list, side] = Array.from(lower?.children ?? []);
    expect(list).toHaveClass(...classes(LOWER_COLUMN));
    // From wide each side block takes a column of its own, as in the content.
    expect(side).toHaveClass(...classes(LOWER_COLUMN));
    // "Próximos 30 dias" at any width: its section title and one filled block.
    expect(list?.firstElementChild?.children).toHaveLength(2);
    expect(list?.firstElementChild?.lastElementChild).toHaveClass(
      "h-48",
      "bg-surface-card"
    );
    // The side blocks only from lateral, like the content's.
    // "Notificações recentes" has no bone: it only enters with a row.
    expect(side?.children).toHaveLength(1);
    const [milestones] = Array.from(side?.children ?? []);
    expect(milestones).toHaveClass("hidden", "lateral:flex");
    // Every title bone in the SectionTitle's shape: its 23.75 px line box
    // (19 px, leading-tight) and 12 px below, as the loaded sections have.
    for (const block of [list?.firstElementChild, milestones]) {
      expect(block?.firstElementChild).toHaveClass("mb-3", "h-[23.75px]");
    }
  });

  it("os ossos de cartão e de lista são preenchidos como o que vai chegar (brancos no celular)", () => {
    const { container } = render(<HomeSkeleton />);
    const bones = [
      ...container.querySelectorAll<HTMLElement>("[aria-hidden='true']"),
    ];
    expect(
      bones.some(
        (bone) =>
          bone.classList.contains("h-[267px]") &&
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

  it("o osso do cartão tem a altura do cartão em repouso: 267 px no celular (botões de 44 px), 259 a partir de md", () => {
    const { container } = render(<HomeSkeleton />);
    const cards = [
      ...container.querySelectorAll<HTMLElement>("[class~='h-[267px]']"),
    ];
    expect(cards).toHaveLength(5);
    for (const bone of cards) {
      expect(bone).toHaveClass(
        "md:h-[259px]",
        "rounded-card",
        "bg-surface-card"
      );
    }
  });

  it("no celular todo osso aparece: nenhum usa o surface-sunken, que é a cor da página ali", () => {
    const { container } = render(<HomeSkeleton />);
    // The notifications skeleton changes its own fill in Task 17.
    const bones = [
      ...container.querySelectorAll<HTMLElement>("div[aria-hidden='true']"),
    ].filter((bone) => !bone.closest("ul"));
    expect(bones.length).toBeGreaterThan(8);
    for (const bone of bones) {
      expect(bone).toHaveClass("bg-surface-card");
      expect(bone).not.toHaveClass("bg-surface-sunken");
    }
  });
});
