import { describe, expect, it } from "vitest";
import { initials } from "@/lib/initials";
import { NBSP } from "./nbsp";

describe("initials", () => {
  it("uses first and last names", () => {
    expect(initials("João Pedro Souza")).toBe("JS");
    expect(initials("  maria  ")).toBe("M");
  });

  it("falls back to ? for empty input", () => {
    expect(initials(undefined)).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("keeps the accent and ignores double spaces and NBSP", () => {
    expect(initials("Júlia  Nogueira")).toBe("JN");
    expect(initials(`Érica${NBSP}Silva`)).toBe("ÉS");
  });

  it("a name pasted decomposed (NFD) keeps the accented initial", () => {
    const decomposed = "Érica Silva".normalize("NFD");
    expect(decomposed).not.toBe("Érica Silva");
    expect(initials(decomposed)).toBe("ÉS");
    expect(initials(decomposed)).toBe(initials("Érica Silva"));
  });
});
