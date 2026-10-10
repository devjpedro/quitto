import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LATERAL_UP } from "@/hooks/use-media-query";

const css = readFileSync(
  resolve(import.meta.dirname, "../src/styles/tokens.css"),
  "utf8"
);

const LATERAL_TOKEN_RE = /--breakpoint-lateral:\s*([\d.]+rem);/;

describe("layout breakpoints (DIRECAO › Layout, mockup 12)", () => {
  it("lateral is 1440 px and wide is 1840 px, next to Tailwind's 2xl (1536 px)", () => {
    expect(css).toContain("--breakpoint-lateral: 90rem;");
    expect(css).toContain("--breakpoint-wide: 115rem;");
  });

  it("the JS cut of the side column is the lateral token in its own unit: rem follows the browser's font size, px does not", () => {
    const lateral = LATERAL_TOKEN_RE.exec(css)?.[1];
    expect(lateral).toBe("90rem");
    expect(LATERAL_UP).toBe(`(min-width: ${lateral})`);
  });
});
