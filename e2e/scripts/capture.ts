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
/** From lateral (90rem) up the home can show "Notificações recentes". */
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
const name = arg("name", "home");
let path = arg("path", "/");
let expectedPath = new URL(path, WEB).pathname;
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

/** The first loading state still on screen, as a tag with its classes. */
function stillLoading(page: Page): Promise<string> {
  return page
    .evaluate((selector) => {
      const element = [...document.querySelectorAll(selector)].find((each) =>
        each.checkVisibility()
      );
      return element
        ? `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}">`
        : "nada visível agora";
    }, LOADING)
    .catch(() => "a página fechou");
}

/**
 * Waits until no loading state is on screen (the home's skeleton included).
 * On timeout, says which screen and what was still loading.
 */
async function noLoading(page: Page, where: string): Promise<void> {
  try {
    await page.waitForFunction(
      (selector) =>
        ![...document.querySelectorAll(selector)].some((element) =>
          element.checkVisibility()
        ),
      LOADING
    );
  } catch (error) {
    throw new Error(
      `${where}: ainda carregando após 30 s: ${await stillLoading(page)}`,
      { cause: error }
    );
  }
}

/**
 * Waits for the page to settle before a shot. networkidle is not enough: it
 * is met while the bundle still hydrates (no request for 500 ms), and only
 * then "Notificações recentes" asks for its list (useRecentNotifications waits
 * for hydration and a lateral screen). So wait for no loading state; then, on
 * the home from lateral up, for that list or its empty state, but only if the
 * block is there: the first access has no lower part, and a failed list takes
 * the block away. Never demand it.
 */
async function settle(page: Page, width: number, where: string): Promise<void> {
  await noLoading(page, where);
  if (expectedPath === "/" && width >= LATERAL) {
    const recent = page.getByRole("region", { name: "Notificações recentes" });
    if ((await recent.count()) > 0) {
      try {
        // The skeleton is aria-hidden, so neither of these matches it.
        await recent
          .getByRole("list")
          .or(recent.getByRole("heading", { name: "Nada novo por aqui" }))
          .first()
          .waitFor();
      } catch (error) {
        throw new Error(
          `${where}: "Notificações recentes" não mostrou a lista nem o estado vazio em 30 s (a API de notificações falhou?)`,
          { cause: error }
        );
      }
    }
  }
  await noLoading(page, where);
  await page.evaluate(() => document.fonts.ready);
}

const session = await sessionCookies();
const cookie = session.map((c) => `${c.name}=${c.value}`).join("; ");

async function api<T>(route: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEB}/api${route}`, {
    ...init,
    headers: {
      cookie,
      origin: WEB,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${route} respondeu ${res.status}`);
  }
  return (await res.json()) as T;
}

if (process.argv.includes("--accept-invites")) {
  // The spectator's view (F5): accept the account's pending invites first.
  const home = await api<{ actions: { kind: string; token?: string }[] }>(
    "/home"
  );
  for (const action of home.actions) {
    if (action.kind === "invite" && action.token) {
      await api(`/invites/${action.token}/accept`, { method: "POST" });
    }
  }
}

const contractTitle = process.argv.includes("--contract")
  ? arg("contract")
  : null;
if (contractTitle) {
  const contracts = await api<{ id: string; title: string }[]>("/contracts");
  const target = contracts.find((c) => c.title === contractTitle);
  if (!target) {
    throw new Error(
      `${account} não tem o contrato "${contractTitle}": rodou o seed:demo?`
    );
  }
  const search = new URLSearchParams();
  if (process.argv.includes("--installment")) {
    const detail = await api<{
      installments: { id: string; sequence: number }[];
    }>(`/contracts/${target.id}`);
    const wanted = Number(arg("installment"));
    const it = detail.installments.find((i) => i.sequence === wanted);
    if (!it) {
      throw new Error(`"${contractTitle}" não tem a parcela ${wanted}`);
    }
    search.set("installment", it.id);
  }
  if (process.argv.includes("--tab")) {
    search.set("tab", arg("tab"));
  }
  path = `/contracts/${target.id}${search.size > 0 ? `?${search}` : ""}`;
  expectedPath = `/contracts/${target.id}`;
}

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
      const file = join(out, `${account}-${name}-${size.name}-${theme}`);
      const where = `${account} ${size.width}x${size.height} ${theme} (${path})`;
      await settle(page, size.width, where);
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
      await settle(page, size.width, `${where}, página inteira`);
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
