import { describe, expect, it } from "vitest";
import { indexFromScroll } from "@/features/home/lib/carousel";

describe("indexFromScroll", () => {
  it("arredonda para o cartão mais perto e fica dentro da lista", () => {
    expect(indexFromScroll(0, 300, 5)).toBe(0);
    expect(indexFromScroll(310, 300, 5)).toBe(1);
    expect(indexFromScroll(5000, 300, 5)).toBe(4);
    expect(indexFromScroll(-20, 300, 5)).toBe(0);
  });

  it("sem medida (ainda não montou) é o primeiro", () => {
    expect(indexFromScroll(120, 0, 5)).toBe(0);
    expect(indexFromScroll(120, 300, 0)).toBe(0);
  });
});
