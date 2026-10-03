import { describe, expect, it } from "vitest";
import { sequencesLabel, sequencesList } from "@/lib/sequences-label";

describe("sequencesLabel", () => {
  it("uma, duas, uma faixa seguida e soltas", () => {
    expect(sequencesLabel([5], 12, "pt-BR")).toBe("parcela 5 de 12");
    expect(sequencesLabel([3, 4], 12, "pt-BR")).toBe("parcelas 3 e 4 de 12");
    expect(
      sequencesLabel(
        [
          28, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
          23, 24, 25, 26, 27,
        ],
        60,
        "pt-BR"
      )
    ).toBe("parcelas 5 a 28 de 60");
    expect(sequencesLabel([3, 5, 9], 12, "pt-BR")).toBe(
      "parcelas 3, 5 e 9 de 12"
    );
  });

  it("no idioma pedido", () => {
    expect(sequencesLabel([3, 4], 12, "en-US")).toBe(
      "installments 3 and 4 of 12"
    );
    expect(sequencesList([5, 6, 7], "en-US")).toBe("5 to 7");
  });
});
