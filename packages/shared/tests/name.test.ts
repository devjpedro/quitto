import { describe, expect, it } from "bun:test";
import { normalizeName } from "../src/name";

const NBSP = String.fromCharCode(160);
// Invisible: zero-width space, non-joiner, joiner and word joiner.
const ZERO_WIDTH = [8203, 8204, 8205, 8288].map((code) =>
  String.fromCharCode(code)
);

describe("normalizeName", () => {
  it("tira o acento, passa para minúsculas e deixa um espaço só", () => {
    expect(normalizeName("  Marína   Pires ")).toBe("marina pires");
    expect(normalizeName("JÚLIA NOGUEIRA")).toBe("julia nogueira");
    expect(normalizeName(`João${NBSP}Souza`)).toBe("joao souza");
    expect(normalizeName("   ")).toBe("");
  });

  it("ignora os caracteres de largura zero, em qualquer lugar do nome", () => {
    for (const invisible of ZERO_WIDTH) {
      expect(normalizeName(`Marina Pires${invisible}`)).toBe("marina pires");
      expect(normalizeName(`Mari${invisible}na Pires`)).toBe("marina pires");
      expect(normalizeName(`${invisible}Marina Pires`)).toBe("marina pires");
    }
  });
});
