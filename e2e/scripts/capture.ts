import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

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
/** From lateral (90rem) up the home shows "Notificações recentes". */
const LATERAL = 1440;
/**
 * Every loading state the app draws: the Skeleton pulses (ui and legacy), the
 * route's pending state is aria-busy and the toaster's spinner spins.
 */
const LOADING = '.animate-pulse, [aria-busy="true"], .animate-spin';

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
const expectedPath = new URL(path, WEB).pathname;
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

/**
 * Waits for the page to settle before a shot. networkidle is not enough: it
 * is met while the bundle still hydrates (no request for 500 ms), and only
 * then "Notificações recentes" asks for its list (useRecentNotifications waits
 * for hydration and a lateral screen). So, on the home from lateral up, wait
 * for that list or its empty state; then for no loading state on screen.
 */
async function settle(page: Page, width: number): Promise<void> {
  if (expectedPath === "/" && width >= LATERAL) {
    const recent = page.getByRole("region", { name: "Notificações recentes" });
    // The skeleton is aria-hidden, so neither of these matches it.
    await recent
      .getByRole("list")
      .or(recent.getByRole("heading", { name: "Nada novo por aqui" }))
      .first()
      .waitFor();
  }
  await page.waitForFunction(
    (selector) =>
      ![...document.querySelectorAll(selector)].some((element) =>
        element.checkVisibility()
      ),
    LOADING
  );
  await page.evaluate(() => document.fonts.ready);
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
      // A session the app refused lands on /login: never save that as the page.
      const landed = new URL(page.url()).pathname;
      if (landed !== expectedPath) {
        throw new Error(
          `${account} caiu em ${landed}, não em ${expectedPath}: rodou o seed:demo?`
        );
      }
      const file = join(out, `${account}-${size.name}-${theme}`);
      await settle(page, size.width);
      await page.screenshot({ path: `${file}.png` });
      if (size.mobile) {
        // A fullPage shot paints the phone's fixed tab bar where the first
        // screen left it, over the list. Stretch the viewport to the document
        // instead, so the bar lands at the bottom, as in the reference
        // (mockup13-shots/D-390-claro-pagina.png). Not from md up: the
        // sidebar is sticky at 100dvh and would grow with a stretched viewport.
        const height = await page.evaluate(
          () => document.documentElement.scrollHeight
        );
        await page.setViewportSize({ width: size.width, height });
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(resolve))
        );
      }
      await settle(page, size.width);
      await page.screenshot({
        path: `${file}-pagina.png`,
        fullPage: !size.mobile,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.info(`capturas em ${out}`);
