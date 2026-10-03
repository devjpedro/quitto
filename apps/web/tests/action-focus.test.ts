import { describe, expect, it } from "vitest";
import { focusIndexAfterRemoval } from "@/features/home/lib/action-focus";

describe("focusIndexAfterRemoval", () => {
  it("o cartão que ficou no mesmo índice; o anterior quando saiu o último", () => {
    expect(focusIndexAfterRemoval(0, 2)).toBe(0);
    expect(focusIndexAfterRemoval(1, 2)).toBe(1);
    expect(focusIndexAfterRemoval(2, 2)).toBe(1);
  });

  it("sem cartão sobrando, nenhum (o foco vai para a lista)", () => {
    expect(focusIndexAfterRemoval(0, 0)).toBeNull();
  });
});
