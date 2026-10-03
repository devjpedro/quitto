import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(import.meta.dirname, "../src/styles/tokens.css"),
  "utf8"
);

describe("layout breakpoints (DIRECAO › Layout, mockup 12)", () => {
  it("lateral is 1440 px and wide is 1840 px, next to Tailwind's 2xl (1536 px)", () => {
    expect(css).toContain("--breakpoint-lateral: 90rem;");
    expect(css).toContain("--breakpoint-wide: 115rem;");
  });
});
