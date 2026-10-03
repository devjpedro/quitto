import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { AppIcon } from "../src/components/app-icon";

// The app icon as markup, from the AppIcon component, so no icon file drifts
// from it. Playwright lives in the e2e workspace only: this file writes the
// favicon, and e2e/scripts/app-icons.ts imports appIconMarkup to rasterize
// the PNGs (importing it rewrites the favicon too, which is the point: one
// command regenerates every icon). After changing AppIcon, that is the
// command: cd e2e && bun scripts/app-icons.ts. Run alone, this file rewrites
// only the favicon and warns that the PNGs were left as they were.

/** The AppIcon as SVG markup, `size` px wide; `maskable` fills the square edge to edge. */
export function appIconMarkup(size: number, maskable = false): string {
  return renderToStaticMarkup(<AppIcon maskable={maskable} size={size} />);
}

writeFileSync(
  resolve(import.meta.dirname, "../public/favicon.svg"),
  appIconMarkup(32)
);
console.info("favicon.svg gerado em apps/web/public");

const ranAlone =
  resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (ranAlone) {
  console.warn(
    "os PNGs (apple-touch-icon, icon-192, icon-512, icon-maskable-512) não foram regerados: depois de mudar o AppIcon, rode cd e2e && bun scripts/app-icons.ts"
  );
}
