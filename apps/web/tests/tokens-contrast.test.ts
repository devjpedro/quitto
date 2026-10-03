import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

const css = readFileSync(
  resolve(import.meta.dirname, "../src/styles/tokens.css"),
  "utf8"
);

const TOKEN_RE = /--([a-z-]+):\s*(#[0-9a-fA-F]{6});/g;

function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`block ${selector} not found`);
  }
  const body = css.slice(start, css.indexOf("}", start));
  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(TOKEN_RE)) {
    if (name && value) {
      tokens[name] = value;
    }
  }
  return tokens;
}

const light = readBlock(":root");
const dark = readBlock(".dark");

// [foreground, background] pairs actually used together in the UI.
const TEXT_PAIRS: [string, string][] = [
  ["ink", "surface"],
  ["ink", "surface-sunken"],
  ["ink", "surface-raised"],
  ["ink", "canvas"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-sunken"],
  ["ink-muted", "surface-raised"],
  ["ink-muted", "canvas"],
  ["ink-inverse", "ink"],
  ["brand", "surface"],
  ["brand", "brand-subtle"],
  ["brand", "surface-raised"],
  ["ink-inverse", "brand"],
  ["on-brand", "brand-surface"],
  ["on-brand-muted", "brand-surface"],
  ["on-highlight", "highlight"],
  ["warning", "warning-subtle"],
  ["warning", "surface"],
  ["danger", "danger-subtle"],
  ["danger", "surface"],
  ["ink-inverse", "danger"],
];

describe("design tokens", () => {
  it("defines every light token in dark mode too", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [theme, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${theme}: ${fg} on ${bg} passes WCAG AA (4.5:1)`, () => {
        const fgHex = tokens[fg];
        const bgHex = tokens[bg];
        expect(fgHex, `missing --${fg}`).toBeDefined();
        expect(bgHex, `missing --${bg}`).toBeDefined();
        expect(
          contrastRatio(fgHex as string, bgHex as string)
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("contrastRatio", () => {
  it("is 21 for black on white and symmetric", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it("rejects malformed hex", () => {
    expect(() => contrastRatio("#FFF", "#000000")).toThrow("invalid hex");
  });
});
