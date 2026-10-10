import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(import.meta.dirname, path), "utf8");

const css = read("../src/index.css");
const frame = read("../src/components/layout/app-frame.tsx");

/** The room the main keeps at its foot for the fixed tab bar, its raised plus button and a breath. */
const TAB_BAR_ROOM = "calc(5.5rem + env(safe-area-inset-bottom))";

describe("the phone's tab bar never covers the focus", () => {
  it("below md, the shell scrolls a focused element above the fixed tab bar, never under it", () => {
    // Without it, Tab onto the last row of "Próximos 30 dias" left 7 of its
    // 64 px above the bar, and a row already on screen was not scrolled at all
    // (review of Task 15, I3).
    const start = css.indexOf("@media (width < 48rem)");
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("}", start));
    expect(block).toContain("html:has(#app-shell)");
    expect(block).toContain(`scroll-padding-bottom: ${TAB_BAR_ROOM};`);
  });

  it("the scroll padding is the same room the main keeps at its foot", () => {
    expect(frame).toContain(`pb-[${TAB_BAR_ROOM.replaceAll(" ", "")}]`);
  });
});
