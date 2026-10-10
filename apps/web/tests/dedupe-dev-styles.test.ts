import { describe, expect, it } from "vitest";
import { dedupeDevStyles } from "../scripts/dedupe-dev-styles";

const SHEET = [
  "\n/* /@fs/node_modules/@fontsource/geist/index.css */\n@font-face{}",
  "\n/* /src/index.css */\n.flex{display:flex}@media(width>=90rem){.lateral\\:grid{display:grid}}",
  "\n/* /@fs//node_modules/tailwindcss/index.css */\n.flex{display:flex}",
  "\n/* /@fs//src/styles/tokens.css */\n:root{--brand:#1F5A32}",
].join("\n");

describe("dedupeDevStyles", () => {
  it("keeps the fonts and src/index.css, and drops the @imports compiled again", () => {
    const css = dedupeDevStyles(SHEET);
    expect(css).toContain("@font-face");
    expect(css).toContain(".lateral\\:grid");
    expect(css).not.toContain("tailwindcss/index.css");
    expect(css).not.toContain("tokens.css");
    // The only ".flex" left is the one src/index.css brought, before "lateral:grid".
    expect(css.match(/\.flex\{/g)).toHaveLength(1);
  });

  it("leaves an empty sheet alone", () => {
    expect(dedupeDevStyles("")).toBe("");
  });
});
