import { describe, expect, it } from "vitest";
import { AVATAR_TONES, avatarColor, normalizeName } from "@/lib/avatar-color";
import { NBSP } from "./nbsp";

// Invisible: zero-width space, non-joiner, joiner and word joiner.
const ZERO_WIDTH = [8203, 8204, 8205, 8288].map((code) =>
  String.fromCharCode(code)
);
const WARM_TONE_RE =
  /^bg-avatar-(clay|ochre|plum|olive|cocoa|rose|wine|graphite)$/;

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

describe("avatarColor", () => {
  // Computed with the mockup 13 algorithm (FNV-1a 32 + murmur3 finalizer, mod 8).
  it.each([
    ["Marina Pires", "bg-avatar-clay"],
    ["Sérgio Almeida", "bg-avatar-clay"],
    ["Helena Duarte", "bg-avatar-ochre"],
    ["Ana Rocha", "bg-avatar-ochre"],
    ["Bia Lopes", "bg-avatar-plum"],
    ["Diego Martins", "bg-avatar-plum"],
    ["Carlos Lima", "bg-avatar-cocoa"],
    ["Theo Martins", "bg-avatar-cocoa"],
    ["João Souza", "bg-avatar-rose"],
    ["Renata Campos", "bg-avatar-rose"],
    ["Rafael Prado", "bg-avatar-wine"],
    ["Júlia Nogueira", "bg-avatar-wine"],
  ])("%s → %s", (name, tone) => {
    expect(avatarColor(name)).toBe(tone);
  });

  it("nome difícil: acento, caixa, espaços duplos, NBSP e pontas dão o mesmo tom", () => {
    const tone = avatarColor("Marina Pires");
    for (const variant of [
      "marina  pires ",
      "Marína Pires",
      "MARINA PIRES",
      `Marina${NBSP}Pires`,
      " Marina Pires",
      ...ZERO_WIDTH.map((invisible) => `Marina Pires${invisible}`),
      ...ZERO_WIDTH.map((invisible) => `Marina Pi${invisible}res`),
    ]) {
      expect(avatarColor(variant)).toBe(tone);
    }
  });

  it("vazio não quebra: sempre o mesmo tom", () => {
    expect(avatarColor("")).toBe("bg-avatar-olive");
    expect(avatarColor("   ")).toBe("bg-avatar-olive");
  });

  it("8 tons, nenhum teal, azul ou o verde da marca", () => {
    expect(AVATAR_TONES).toHaveLength(8);
    for (const tone of AVATAR_TONES) {
      expect(tone).toMatch(WARM_TONE_RE);
    }
  });
});
