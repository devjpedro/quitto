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
});
