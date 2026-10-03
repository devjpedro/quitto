import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

// The fixed screens of this phase (DIRECAO › Checklist de acabamento): a
// phone, the owner's laptop and a wide monitor, in light and dark. Signs in
// as a demo account (bun run seed:demo in apps/api, right before) and saves
// the viewport and the full page. --sizes swaps the widths (e.g. the 1536
// and 1840 tiers of open question 3).
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const DEFAULT_SIZES = "390x844,1512x860,1920x1080";
const THEMES = ["light", "dark"] as const;
/** Below md the app is the phone layout: emulate a phone there. */
const MD = 768;

function arg(name: string, fallback?: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at >= 0 ? process.argv[at + 1] : fallback;
  if (!value) {
    throw new Error(`--${name} é obrigatório`);
  }
  return value;
}

const account = arg("account");
const out = arg("out");
const path = arg("path", "/");
const sizes = arg("sizes", DEFAULT_SIZES)
  .split(",")
  .map((size) => {
    const [width, height] = size.split("x").map(Number) as [number, number];
    return { name: String(width), width, height, mobile: width < MD };
  });
mkdirSync(out, { recursive: true });

/**
 * Signs in once and returns the session cookies for every context. Through
 * fetch, not context.request: under Bun, Playwright's request client fails to
 * parse the Set-Cookie and the post hangs until its timeout.
 */
async function sessionCookies(): Promise<
  { name: string; url: string; value: string }[]
> {
  const res = await fetch(`${WEB}/api/auth/sign-in/email`, {
    method: "POST",
    // The Origin a browser sends (Better Auth's CSRF check wants one).
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({
      email: `${account}@demo.quitto.dev`,
      password: "quitto123",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `login de ${account} falhou (${res.status}): rodou o seed:demo?`
    );
  }
  return res.headers.getSetCookie().map((header) => {
    const pair = header.split(";")[0] ?? "";
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: WEB };
  });
}

const session = await sessionCookies();
const browser = await chromium.launch();
try {
  for (const size of sizes) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        locale: "pt-BR",
        isMobile: size.mobile,
        hasTouch: size.mobile,
      });
      await context.addCookies([
        ...session,
        { name: "theme", value: theme, url: WEB },
      ]);
      const page = await context.newPage();
      await page.goto(`${WEB}${path}`);
      await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const file = join(out, `${account}-${size.name}-${theme}`);
      await page.screenshot({ path: `${file}.png` });
      await page.screenshot({ path: `${file}-pagina.png`, fullPage: true });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.info(`capturas em ${out}`);
