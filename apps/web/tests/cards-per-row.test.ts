import { describe, expect, it } from "vitest";
import {
  pastTheRow,
  seeAllClasses,
} from "@/features/home/components/cards-per-row";

const TIERS = ["lg", "2xl", "wide"] as const;
type Tier = (typeof TIERS)[number];

/** Mobile-first, as the CSS reads it: the last of base → lg → 2xl → wide that says hidden or shown. */
function shownAt(classes: string, tier: Tier): boolean {
  const tokens = new Set(classes.split(" "));
  let shown = !tokens.has("hidden");
  for (const breakpoint of TIERS.slice(0, TIERS.indexOf(tier) + 1)) {
    if (tokens.has(`${breakpoint}:hidden`)) {
      shown = false;
    }
    if (tokens.has(`${breakpoint}:block`) || tokens.has(`${breakpoint}:flex`)) {
      shown = true;
    }
  }
  return shown;
}

const cardsShownAt = (count: number, tier: Tier) =>
  Array.from({ length: count }, (_, index) => pastTheRow(index)).filter(
    (classes) => shownAt(classes || "", tier)
  ).length;

describe("cartões por linha no desktop", () => {
  it("3 por linha em lg, 4 em 2xl e 5 em wide", () => {
    expect(cardsShownAt(8, "lg")).toBe(3);
    expect(cardsShownAt(8, "2xl")).toBe(4);
    expect(cardsShownAt(8, "wide")).toBe(5);
  });

  it("o Ver todas (N) aparece numa largura se, e só se, algum cartão está fora da linha ali (1 a 8 ações)", () => {
    for (let count = 1; count <= 8; count++) {
      const classes = seeAllClasses(count);
      for (const tier of TIERS) {
        const someCardHidden = cardsShownAt(count, tier) < count;
        const seeAllShown = classes !== null && shownAt(classes, tier);
        expect(seeAllShown, `${count} ações em ${tier}`).toBe(someCardHidden);
      }
    }
  });
});
