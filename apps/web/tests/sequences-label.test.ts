import { describe, expect, it } from "vitest";
import { sequencesLabel, sequencesList } from "@/lib/sequences-label";

const NBSP = String.fromCharCode(0xa0);
/** Writes "~" for the no-break space the installment messages keep between numbers. */
const nb = (text: string) => text.replaceAll("~", NBSP);

/** from..to, both included. */
const span = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("sequencesLabel", () => {
  it("uma, duas, uma faixa seguida e soltas", () => {
    expect(sequencesLabel([5], 12, "pt-BR")).toBe(nb("parcela~5~de~12"));
    expect(sequencesLabel([3, 4], 12, "pt-BR")).toBe(
      nb("parcelas~3 e 4~de~12")
    );
    expect(
      sequencesLabel(
        [
          28, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
          23, 24, 25, 26, 27,
        ],
        60,
        "pt-BR"
      )
    ).toBe(nb("parcelas~5~a~28~de~60"));
    expect(sequencesLabel([3, 5, 9], 12, "pt-BR")).toBe(
      nb("parcelas~3, 5 e 9~de~12")
    );
  });

  it("no idioma pedido", () => {
    expect(sequencesLabel([3, 4], 12, "en-US")).toBe(
      nb("installments~3 and 4~of~12")
    );
    expect(sequencesList([5, 6, 7], "en-US")).toBe(nb("5~to~7"));
  });

  it("uma lacuna: cada trecho seguido de 3 ou mais vira faixa", () => {
    expect(sequencesLabel([...span(5, 12), ...span(14, 28)], 60, "pt-BR")).toBe(
      nb("parcelas~5~a~12 e 14~a~28~de~60")
    );
    expect(sequencesLabel([...span(5, 9), ...span(11, 28)], 60, "pt-BR")).toBe(
      nb("parcelas~5~a~9 e 11~a~28~de~60")
    );
    // A run of 1 or 2 shows each number.
    expect(sequencesLabel([3, 4, 6], 12, "pt-BR")).toBe(
      nb("parcelas~3, 4 e 6~de~12")
    );
    expect(sequencesLabel([7, 1, 2, 3], 12, "pt-BR")).toBe(
      nb("parcelas~1~a~3 e 7~de~12")
    );
    expect(sequencesLabel([...span(5, 12), ...span(14, 28)], 60, "en-US")).toBe(
      nb("installments~5~to~12 and 14~to~28~of~60")
    );
  });

  it("várias lacunas: até 3 itens, a lista; com mais, quantas e entre quais", () => {
    expect(
      sequencesLabel(
        [...span(1, 4), ...span(6, 9), ...span(11, 14)],
        24,
        "pt-BR"
      )
    ).toBe(nb("parcelas~1~a~4, 6~a~9 e 11~a~14~de~24"));
    expect(sequencesLabel([3, 5, 7, ...span(9, 28)], 60, "pt-BR")).toBe(
      nb("23 parcelas entre 3~e~28~de~60")
    );
    expect(sequencesLabel([7, 5, 3, 1], 12, "pt-BR")).toBe(
      nb("4 parcelas entre 1~e~7~de~12")
    );
    expect(sequencesLabel([1, 3, 5, 7], 12, "en-US")).toBe(
      nb("4 installments between 1~and~7~of~12")
    );
  });
});
