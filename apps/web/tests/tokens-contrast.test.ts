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
  ["brand", "surface-sunken"],
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

// [foreground, background] pairs of non-text UI (WCAG 1.4.11, 3:1). From md
// the sidebar sits on the canvas (structure B, mockup 12): its focus ring and
// the active row's black pill must stand out from it.
const NON_TEXT_PAIRS: [string, string][] = [
  ["brand", "canvas"],
  ["ink", "canvas"],
];

// [foreground, background, alpha] text drawn with opacity on a token: the
// count on the active (black) sidebar row is `text-ink-inverse/70`.
const ALPHA_TEXT_PAIRS: [string, string, number][] = [
  ["ink-inverse", "ink", 0.7],
];

/** `fg` at `alpha` over `bg`, composited per channel as the browser does (sRGB). */
function composite(fg: string, bg: string, alpha: number): string {
  const channel = (hex: string, at: number) =>
    Number.parseInt(hex.slice(at, at + 2), 16);
  const mixed = [1, 3, 5].map((at) =>
    Math.round(channel(fg, at) * alpha + channel(bg, at) * (1 - alpha))
      .toString(16)
      .padStart(2, "0")
  );
  return `#${mixed.join("")}`;
}

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
    for (const [fg, bg, alpha] of ALPHA_TEXT_PAIRS) {
      it(`${theme}: ${fg} at ${alpha * 100}% on ${bg} passes WCAG AA (4.5:1)`, () => {
        const fgHex = tokens[fg];
        const bgHex = tokens[bg];
        expect(fgHex, `missing --${fg}`).toBeDefined();
        expect(bgHex, `missing --${bg}`).toBeDefined();
        const mixed = composite(fgHex as string, bgHex as string, alpha);
        expect(contrastRatio(mixed, bgHex as string)).toBeGreaterThanOrEqual(
          4.5
        );
      });
    }
    for (const [fg, bg] of NON_TEXT_PAIRS) {
      it(`${theme}: ${fg} on ${bg} passes WCAG 1.4.11 (3:1)`, () => {
        const fgHex = tokens[fg];
        const bgHex = tokens[bg];
        expect(fgHex, `missing --${fg}`).toBeDefined();
        expect(bgHex, `missing --${bg}`).toBeDefined();
        expect(
          contrastRatio(fgHex as string, bgHex as string)
        ).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("composite", () => {
  it("mixes per channel: white at 70% on #111111 is #b8b8b8", () => {
    expect(composite("#ffffff", "#111111", 0.7)).toBe("#b8b8b8");
    expect(composite("#151613", "#ecebe6", 0.7)).toBe("#565652");
  });
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
