import { resolve } from "node:path";
import { chromium } from "@playwright/test";
// Importing it also rewrites apps/web/public/favicon.svg: every icon at once.
import { appIconMarkup } from "../../apps/web/scripts/app-icons";

// The PWA and touch icons, rasterized from the same markup as the favicon.
// Run: cd e2e && bun scripts/app-icons.ts
const pub = (name: string) =>
  resolve(import.meta.dirname, "../../apps/web/public", name);

const PNGS = [
  // iOS rounds the touch icon itself: full bleed, like the maskable one.
  { file: "apple-touch-icon.png", size: 180, maskable: true },
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const png of PNGS) {
    await page.setViewportSize({ width: png.size, height: png.size });
    await page.setContent(
      `<html><body style="margin:0">${appIconMarkup(png.size, png.maskable)}</body></html>`
    );
    await page
      .locator("svg")
      .screenshot({ path: pub(png.file), omitBackground: true });
  }
} finally {
  await browser.close();
}
console.info("ícones gerados em apps/web/public");
