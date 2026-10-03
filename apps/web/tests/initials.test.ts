import { describe, expect, it } from "vitest";
import { initials } from "@/lib/initials";

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
    expect(initials(`Érica${String.fromCharCode(160)}Silva`)).toBe("ÉS");
  });
});
