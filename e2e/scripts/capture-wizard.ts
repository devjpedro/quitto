import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

// The wizard by frame (mockup 15): signs in as the demo account "agora"
// (João Souza; run seed:demo first), drives the form to each frame and
// saves the viewport in light and dark. --measure writes the geometry the
// review checks (the logo at x=22, the panel at x=232, the card's width).
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const THEMES = ["light", "dark"] as const;
const MD = 768;

function arg(name: string, fallback?: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at >= 0 ? process.argv[at + 1] : fallback;
  if (!value) {
    throw new Error(`--${name} é obrigatório`);
  }
  return value;
}

const out = arg("out");
const frames = arg("frames", "about-empty,about-filled").split(",");
const measure = process.argv.includes("--measure");
const sizes = arg("sizes", "390x844,1512x860")
  .split(",")
  .map((size) => {
    const [width, height] = size.split("x").map(Number) as [number, number];
    return { width, height, mobile: width < MD };
  });
mkdirSync(out, { recursive: true });

async function about(page: Page): Promise<void> {
  await page.getByRole("radio", { name: "Eu recebo" }).click();
  await page.getByLabel("Nome do contrato").fill("Notebook da Renata");
  await page
    .getByLabel("Descrição opcional")
    .fill("Dell Inspiron 15, usado, com carregador");
}

const SPLIT_OPTION = /valor total/i;
const ADJUST_LINK = /Ajustar uma a uma/;
const TAKE_FIX = /^Tirar/;

async function next(page: Page): Promise<void> {
  await page.getByTestId("wizard-footer").getByRole("button").last().click();
}

/** The 10th at least `daysAhead` days ahead: "todo dia 10", as in the mockup. */
function tenth(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  if (date.getUTCDate() > 10) {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  date.setUTCDate(10);
  return date.toISOString().slice(0, 10);
}

async function schedule(
  page: Page,
  total = "6000,00",
  due = tenth(30)
): Promise<void> {
  await about(page);
  await next(page);
  await page.getByRole("radio", { name: SPLIT_OPTION }).click();
  await page.getByLabel("Valor total", { exact: true }).fill(total);
  await page.getByLabel("Parcelas", { exact: true }).fill("12");
  await page.getByLabel("1º vencimento").fill(due);
  await page.getByLabel("1º vencimento").blur();
}

async function adjustMismatch(page: Page): Promise<void> {
  await schedule(page);
  await page.getByRole("button", { name: ADJUST_LINK }).click();
  await page.getByLabel("Valor da parcela 1", { exact: true }).fill("1600,00");
  await page.getByLabel("Valor da parcela 1", { exact: true }).blur();
}

/** Each frame from a fresh /contracts/new. Tasks 7 and 8 add theirs here. */
const DRIVE: Record<string, (page: Page) => Promise<void>> = {
  "about-empty": async () => undefined,
  "about-filled": about,
  schedule: async (page) => await schedule(page),
  // D6: total zero and a first due date in the past, after "Continuar".
  "schedule-errors": async (page) => {
    await schedule(page, "0", tenth(-40));
    await next(page);
  },
  "adjust-mismatch": adjustMismatch,
  "adjust-ok": async (page) => {
    await adjustMismatch(page);
    await page.getByRole("button", { name: TAKE_FIX }).click();
  },
};

async function sessionCookies() {
  const res = await fetch(`${WEB}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({
      email: "agora@demo.quitto.dev",
      password: "quitto123",
    }),
  });
  if (!res.ok) {
    throw new Error(`login falhou (${res.status}): rodou o seed:demo?`);
  }
  return res.headers.getSetCookie().map((header) => {
    const pair = header.split(";")[0] ?? "";
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: WEB };
  });
}

async function geometry(page: Page) {
  return await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const r = element.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    return {
      logo: box('[data-testid="wizard-rail"] [role="img"]'),
      panel: box("#conteudo"),
      stage: box('[data-testid="wizard-stage"]'),
      card: box('[data-testid="wizard-stage"] article'),
      form: box('[data-testid="wizard-form"]'),
      // The box above does not show the padding (the 860 band, 36/28 at the sides): this does.
      formPad: (() => {
        const element = document.querySelector('[data-testid="wizard-form"]');
        if (!element) {
          return null;
        }
        const style = getComputedStyle(element);
        return {
          top: Math.round(Number.parseFloat(style.paddingTop)),
          left: Math.round(Number.parseFloat(style.paddingLeft)),
          right: Math.round(Number.parseFloat(style.paddingRight)),
        };
      })(),
      scrollX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

const session = await sessionCookies();
const browser = await chromium.launch();
const report: Record<string, unknown> = {};
try {
  for (const frame of frames) {
    const drive = DRIVE[frame];
    if (!drive) {
      throw new Error(`quadro desconhecido: ${frame}`);
    }
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
        await page.goto(`${WEB}/contracts/new`);
        await page
          .locator("html[data-hydrated]")
          .waitFor({ state: "attached" });
        // A session the app refused lands on /login: never save that as the wizard.
        const landed = new URL(page.url()).pathname;
        if (landed !== "/contracts/new") {
          throw new Error(`caiu em ${landed}: rodou o seed:demo?`);
        }
        await drive(page);
        await page.waitForTimeout(400); // the step's slide and the card's fade
        await page.evaluate(() => document.fonts.ready);
        const name = `${frame}-${size.width}-${theme}`;
        await page.screenshot({ path: join(out, `${name}.png`) });
        if (measure && theme === "light") {
          report[`${frame}-${size.width}`] = await geometry(page);
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (measure) {
  writeFileSync(join(out, "geometry.json"), JSON.stringify(report, null, 2));
}
console.info(`capturas em ${out}${measure ? " (com geometry.json)" : ""}`);
