import { expect, test } from "@playwright/test";
import {
  API_FAILURE,
  GREETING,
  nowLink,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";
import { card, collectHydrationErrors } from "../home-helpers";

const NBSP = String.fromCharCode(160);

test("cold start: o shell e a saudação aparecem na hora, e a seção carrega depois", async ({
  page,
}) => {
  await page.clock.install();
  await signup(page);
  await seedContract(page.request, { title: "Frio E2E" });
  // A cold API: /api/home answers only once warm, the shell's badge fetch
  // after hydration included. Time runs on the page clock, not the wall's.
  let warmUp: () => void = () => undefined;
  const warm = new Promise<void>((resolve) => {
    warmUp = resolve;
  });
  await page.route("**/api/home", async (route) => {
    await warm;
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  // Nothing from /api/home has arrived: only the shell can show these.
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  await expect(card(page, "Frio E2E · parcela 1 de 3")).toHaveCount(0);
  // Past the 3 s notice, far from the 15 s timeout.
  await page.clock.fastForward(4000);
  await expect(
    page.getByRole("status").filter({ hasText: "Conectando ao servidor…" })
  ).toBeVisible();
  warmUp();
  await expect(card(page, "Frio E2E · parcela 1 de 3")).toBeVisible();
});

test("API travada: depois do timeout, Tentar de novo recupera", async ({
  page,
}) => {
  await page.clock.install();
  await signup(page);
  await seedContract(page.request, { title: "Travada E2E" });
  let hang = true;
  await page.route("**/api/home", async (route) => {
    if (hang) {
      return; // never answers: the client aborts it at the timeout
    }
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  // 16 s in two jumps, as a user lives it: skeleton, then "Conectando…" at
  // 3 s, then the timeout at 15 s. One jump would also fire the link's 50 ms
  // intent preload after the abort, and its loader would refetch the home.
  await page.clock.fastForward(4000);
  await expect(
    page.getByRole("status").filter({ hasText: "Conectando ao servidor…" })
  ).toBeVisible();
  await page.clock.fastForward(12_000);
  await expect(page.getByRole("alert")).toContainText(
    "O servidor demorou para responder."
  );
  hang = false;
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(card(page, "Travada E2E · parcela 1 de 3")).toBeVisible();
});

test("Tentar de novo: pelo teclado o foco vai para a seção com o anel; pelo clique, sem o anel", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Anel E2E" });
  let fail = true;
  await page.route("**/api/home", async (route) => {
    if (fail) {
      await route.fulfill(API_FAILURE);
      return;
    }
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
  // The button leaves with the error, so the focus moves to the section. After
  // Enter it shows the ring (the user is on the keyboard)...
  await page.getByRole("button", { name: "Tentar de novo" }).focus();
  await page.keyboard.press("Enter");
  const focused = page.locator(":focus");
  await expect(focused.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
  await expect(focused).toHaveAttribute("tabindex", "-1");
  expect(await focused.evaluate((el) => el.matches(":focus-visible"))).toBe(
    true
  );
  // ...after a click it does not.
  fail = false;
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(
    focused.getByRole("article", { name: "Anel E2E · parcela 1 de 3" })
  ).toBeVisible();
  await expect(focused).toHaveAttribute("tabindex", "-1");
  expect(await focused.evaluate((el) => el.matches(":focus-visible"))).toBe(
    false
  );
});

test("SSR: a home chega no HTML em streaming e o navegador não pede /api/home", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Stream E2E" });
  const homeCalls: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/home") {
      homeCalls.push(req.url());
    }
  });
  const hydrationErrors = collectHydrationErrors(page);
  await page.goto("/");
  await waitForHydrated(page);
  await expect(card(page, "Stream E2E · parcela 1 de 3")).toBeVisible();
  expect(homeCalls).toEqual([]);
  // The server HTML is what the browser renders: no hydration mismatch.
  expect(hydrationErrors).toEqual([]);
  // The raw SSR response, cookie included, already carries the home. The
  // card's name is split in the HTML (the title, then the installment in its
  // own span, with no-break spaces), so each part is checked on its own.
  const html = (await (await page.request.get("/")).text()).replaceAll(
    NBSP,
    " "
  );
  expect(html).toContain("Stream E2E");
  expect(html).toContain("parcela 1 de 3");
});
