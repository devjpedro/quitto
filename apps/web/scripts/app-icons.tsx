import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AppIcon } from "../src/components/app-icon";

// The app icon as markup, from the AppIcon component, so no icon file drifts
// from it. Playwright lives in the e2e workspace only: this file writes the
// favicon, and e2e/scripts/app-icons.ts imports appIconMarkup to rasterize
// the PNGs (importing it rewrites the favicon too, which is the point: one
// command regenerates every icon). Run alone: cd apps/web && bun scripts/app-icons.tsx

/** The AppIcon as SVG markup, `size` px wide; `maskable` fills the square edge to edge. */
export function appIconMarkup(size: number, maskable = false): string {
  return renderToStaticMarkup(<AppIcon maskable={maskable} size={size} />);
}

writeFileSync(
  resolve(import.meta.dirname, "../public/favicon.svg"),
  appIconMarkup(32)
);
console.info("favicon.svg gerado em apps/web/public");
