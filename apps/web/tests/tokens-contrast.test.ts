import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ON_BRAND_TRACK_MIX } from "@/components/ui/installment-bar";
import { contrastRatio, relativeLuminance } from "@/lib/contrast";

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
  // An error toast: its title and description on danger-subtle.
  ["ink", "danger-subtle"],
  ["ink-muted", "danger-subtle"],
  ["ink-inverse", "danger"],
  // Fill, not outline (mockup 13): the card on the panel, what sits inside
  // it, the hover step, the green card's hover and the sidebar's hover.
  ["ink", "surface-card"],
  ["ink-muted", "surface-card"],
  ["ink", "surface-card-hover"],
  ["ink-muted", "surface-card-hover"],
  ["ink", "surface-inset"],
  ["ink-muted", "surface-inset"],
  // The inset (secondary) button's hover, in the panel and on a phone.
  ["ink", "surface-inset-hover"],
  ["ink", "page-inset-hover"],
  ["ink", "row-selected"],
  ["ink-muted", "row-selected"],
  ["brand", "row-selected"],
  ["brand", "surface-card"],
  ["brand", "surface-inset"],
  ["danger", "surface-card"],
  ["warning", "surface-card"],
  ["ink", "nav-hover"],
  ["ink-muted", "nav-hover"],
  ["on-brand", "brand-hover"],
  ["on-brand-muted", "brand-hover"],
  // A hovered card keeps its status text as legible as at rest.
  ["brand", "surface-card-hover"],
  ["danger", "surface-card-hover"],
  ["warning", "surface-card-hover"],
  // The phone (page-surfaces, mockup 13 lines 487-488): what sits inside a
  // white card and the hover step, on the phone's own tokens.
  ["ink", "page-card-hover"],
  ["ink-muted", "page-card-hover"],
  ["brand", "page-card-hover"],
  ["danger", "page-card-hover"],
  ["warning", "page-card-hover"],
  ["ink", "page-inset"],
  ["ink-muted", "page-inset"],
  ["brand", "page-inset"],
  // People have faces: white initials on every avatar tone.
  ["on-avatar", "avatar-clay"],
  ["on-avatar", "avatar-ochre"],
  ["on-avatar", "avatar-plum"],
  ["on-avatar", "avatar-olive"],
  ["on-avatar", "avatar-cocoa"],
  ["on-avatar", "avatar-rose"],
  ["on-avatar", "avatar-wine"],
  ["on-avatar", "avatar-graphite"],
];

// [foreground, background] pairs of non-text UI (WCAG 1.4.11, 3:1). From md
// the sidebar sits on the canvas (structure B, mockup 12): its focus ring and
// the active row's black pill must stand out from it.
const NON_TEXT_PAIRS: [string, string][] = [
  ["brand", "canvas"],
  ["ink", "canvas"],
  // Form fields: the outline against the field and what is around it (WCAG 1.4.11).
  ["field-line", "surface"],
  ["field-line", "surface-sunken"],
  ["field-line", "surface-card"],
  // The installment bar's segments on its track, and the green card's
  // overdue stripe (WCAG 1.4.11).
  ["brand", "track"],
  ["danger", "track"],
  ["warning", "track"],
  ["ink", "track"],
  ["on-brand-alert", "brand-surface"],
  ["on-brand-alert", "brand-hover"],
  // The overdue mark on a sidebar ring, at rest, on hover and on the open
  // contract's row.
  ["danger", "canvas"],
  ["danger", "nav-hover"],
  ["danger", "surface-raised"],
];

// [foreground, background, alpha] text drawn with opacity on a token: the
// count on the active (black) sidebar row is `text-ink-inverse/70`.
const ALPHA_TEXT_PAIRS: [string, string, number][] = [
  ["ink-inverse", "ink", 0.7],
];

// [foreground, overlay, base, percent] non-text drawn on a track that is
// `overlay` at `percent` over `base`: the green card's installment bar, whose
// track is on-brand at ON_BRAND_TRACK_MIX % (installment-bar.tsx), at rest
// and on hover. Overdue is the salmon stripe; paid, a proof waiting and "due
// today" are on-brand (WCAG 1.4.11).
const TRACK_NON_TEXT_PAIRS: [string, string, string, number][] = [
  ["on-brand-alert", "on-brand", "brand-surface", ON_BRAND_TRACK_MIX],
  ["on-brand-alert", "on-brand", "brand-hover", ON_BRAND_TRACK_MIX],
  ["on-brand", "on-brand", "brand-surface", ON_BRAND_TRACK_MIX],
  ["on-brand", "on-brand", "brand-hover", ON_BRAND_TRACK_MIX],
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
    for (const [fg, overlay, base, percent] of TRACK_NON_TEXT_PAIRS) {
      it(`${theme}: ${fg} on ${overlay} at ${percent}% over ${base} passes WCAG 1.4.11 (3:1)`, () => {
        const fgHex = tokens[fg];
        const overlayHex = tokens[overlay];
        const baseHex = tokens[base];
        expect(fgHex, `missing --${fg}`).toBeDefined();
        expect(overlayHex, `missing --${overlay}`).toBeDefined();
        expect(baseHex, `missing --${base}`).toBeDefined();
        const track = composite(
          overlayHex as string,
          baseHex as string,
          percent / 100
        );
        expect(contrastRatio(fgHex as string, track)).toBeGreaterThanOrEqual(3);
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

describe("page-surfaces", () => {
  it("on a phone the card is the surface and what sits inside it is the phone's inset", () => {
    const start = css.indexOf("@utility page-surfaces {");
    expect(start).toBeGreaterThan(-1);
    const body = css.slice(start, css.indexOf("}", start));
    expect(body).toContain("--surface-card: var(--surface);");
    expect(body).toContain("--surface-card-hover: var(--page-card-hover);");
    expect(body).toContain("--surface-inset: var(--page-inset);");
    expect(body).toContain("--surface-inset-hover: var(--page-inset-hover);");
    expect(body).toContain("--divider: var(--page-divider);");
  });

  it("the phone's values are the mockup's (lines 487-488), three layers in dark", () => {
    expect(light["page-card-hover"]).toBe("#f7f6f2");
    expect(light["page-inset"]).toBe(light["surface-sunken"]);
    expect(light["page-divider"]).toBe("#eceae4");
    // The hover steps down, as in the panel (review of Task 15, I2): in
    // dark it meets the divider, between the card and the page.
    expect(dark["page-card-hover"]).toBe("#1f201c");
    expect(dark["page-inset"]).toBe(dark["surface-raised"]);
    expect(dark["page-divider"]).toBe("#1f201c");
    expect(light["page-inset-hover"]).toBe("#e6e5e0");
    expect(dark["page-inset-hover"]).toBe("#363731");
  });
});

// The panel's tokens, [light, dark], as the Global Constraints table has them
// (mockup13-report §4). Pinned by value: a wrong one can pass every contrast
// pair and still swap the layers (an inset lighter than the card in dark).
const PANEL_TOKENS: Record<string, [string, string]> = {
  "surface-card": ["#f1f0eb", "#2e2f2a"],
  "surface-card-hover": ["#eae8e1", "#282924"],
  "surface-inset": ["#ffffff", "#242521"],
  "surface-inset-hover": ["#f4f3ef", "#1c1d1a"],
  divider: ["#e3e1da", "#262723"],
  track: ["#d5d3cc", "#45463f"],
  "nav-hover": ["#efede7", "#1f201c"],
  "brand-hover": ["#174a28", "#24503a"],
  "on-brand-alert": ["#ffb3a6", "#ffb3a6"],
};

function luminance(tokens: Record<string, string>, name: string): number {
  return relativeLuminance(tokens[name] as string);
}

describe("surface layers", () => {
  for (const [name, [lightHex, darkHex]] of Object.entries(PANEL_TOKENS)) {
    it(`--${name} is the table's value in light and dark`, () => {
      expect(light[name]).toBe(lightHex);
      expect(dark[name]).toBe(darkHex);
    });
  }

  it("in the panel, what sits inside a card steps back toward the panel; hover steps one down, in light and in dark", () => {
    // Light: inset (the panel's white) > card > hover.
    expect(light["surface-inset"]).toBe(light.surface);
    expect(luminance(light, "surface-inset")).toBeGreaterThan(
      luminance(light, "surface-card")
    );
    expect(luminance(light, "surface-card")).toBeGreaterThan(
      luminance(light, "surface-card-hover")
    );
    // Dark: inset (the panel itself) < hover < card. Up from the card there
    // is no room (ink-muted is at the AA floor there): the hover steps down,
    // still a step above what sits inside the card.
    expect(dark["surface-inset"]).toBe(dark.surface);
    expect(luminance(dark, "surface-inset")).toBeLessThan(
      luminance(dark, "surface-card-hover")
    );
    expect(luminance(dark, "surface-card-hover")).toBeLessThan(
      luminance(dark, "surface-card")
    );
  });

  it("on a phone (page-surfaces), the card is the surface and what sits inside it is one step away from it", () => {
    // Light: white card > hover > inset.
    expect(luminance(light, "surface")).toBeGreaterThan(
      luminance(light, "page-card-hover")
    );
    expect(luminance(light, "page-card-hover")).toBeGreaterThan(
      luminance(light, "page-inset")
    );
    // Dark: three layers, page < card < inset, and the hover steps down,
    // between the page and the card.
    expect(luminance(dark, "surface-sunken")).toBeLessThan(
      luminance(dark, "surface")
    );
    expect(luminance(dark, "surface")).toBeLessThan(
      luminance(dark, "page-inset")
    );
    expect(luminance(dark, "surface-sunken")).toBeLessThan(
      luminance(dark, "page-card-hover")
    );
    expect(luminance(dark, "page-card-hover")).toBeLessThan(
      luminance(dark, "surface")
    );
  });

  // The open contract's row in the sidebar (surface-raised) is a step past
  // the other rows' hover (nav-hover), or in dark it reads as a stuck hover:
  // the panel's surface sat at 1.06:1 there (review of Task 20, r1).
  it("the sidebar's open row stands a step away from the hover, in light and in dark", () => {
    for (const tokens of [light, dark]) {
      const at = (name: string) => tokens[name] as string;
      expect(
        contrastRatio(at("surface-raised"), at("nav-hover"))
      ).toBeGreaterThanOrEqual(1.1);
    }
  });

  // The hover is a step you can see (DIRECAO › Estados): at 1.04:1 the dark
  // panel's hovered row could not be told apart (review of Task 15, I2).
  const CARD_HOVER_CONTEXTS: [
    string,
    Record<string, string>,
    string,
    string,
  ][] = [
    ["panel, light", light, "surface-card", "surface-card-hover"],
    ["panel, dark", dark, "surface-card", "surface-card-hover"],
    ["phone, light", light, "surface", "page-card-hover"],
    ["phone, dark", dark, "surface", "page-card-hover"],
  ];
  for (const [context, tokens, card, hover] of CARD_HOVER_CONTEXTS) {
    it(`${context}: the card's hover is a visible step down from it`, () => {
      const at = (name: string) => tokens[name] as string;
      expect(contrastRatio(at(card), at(hover))).toBeGreaterThanOrEqual(1.06);
      expect(relativeLuminance(at(hover))).toBeLessThan(
        relativeLuminance(at(card))
      );
    });
  }

  // With the pointer on a card's secondary button the card is hovered too: the
  // button's hover must stay a step away from the hovered card, or its shape
  // melts into it and only the label is left (review of Task 13, I2).
  const INSET_HOVER_CONTEXTS: [
    string,
    Record<string, string>,
    string,
    string,
    string,
  ][] = [
    [
      "panel, light",
      light,
      "surface-inset",
      "surface-inset-hover",
      "surface-card-hover",
    ],
    [
      "panel, dark",
      dark,
      "surface-inset",
      "surface-inset-hover",
      "surface-card-hover",
    ],
    [
      "phone, light",
      light,
      "page-inset",
      "page-inset-hover",
      "page-card-hover",
    ],
    ["phone, dark", dark, "page-inset", "page-inset-hover", "page-card-hover"],
  ];
  for (const [
    context,
    tokens,
    rest,
    hover,
    cardHover,
  ] of INSET_HOVER_CONTEXTS) {
    it(`${context}: the inset button's hover is a visible step and never melts into the hovered card`, () => {
      const at = (name: string) => tokens[name] as string;
      expect(contrastRatio(at(hover), at(rest))).toBeGreaterThanOrEqual(1.05);
      expect(contrastRatio(at(hover), at(cardHover))).toBeGreaterThanOrEqual(
        1.08
      );
    });

    // Hovering the card leaves its secondary button and its neutral tag at
    // rest on the hovered card: 1.052 in the dark panel (review of Task 15,
    // r1). Only the order of luminances kept the hover off the inset; a floor
    // keeps a future tweak from sinking one onto the other.
    it(`${context}: at rest, the inset (secondary button, neutral tag) stays a step away from the hovered card`, () => {
      const at = (name: string) => tokens[name] as string;
      expect(contrastRatio(at(rest), at(cardHover))).toBeGreaterThanOrEqual(
        1.05
      );
    });
  }

  it("the inset hover steps away from the card where it can: darker in the dark panel, lighter in the dark phone, darker on the light phone", () => {
    expect(luminance(dark, "surface-inset-hover")).toBeLessThan(
      luminance(dark, "surface-inset")
    );
    expect(luminance(dark, "page-inset-hover")).toBeGreaterThan(
      luminance(dark, "page-inset")
    );
    expect(luminance(light, "page-inset-hover")).toBeLessThan(
      luminance(light, "page-inset")
    );
  });
});
