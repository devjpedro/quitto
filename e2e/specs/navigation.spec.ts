import { expect, type Page, test } from "@playwright/test";
import {
  advanceDateNow,
  GREETING,
  openNotifications,
  seedContract,
  signup,
} from "../fixtures";

const LOGIN_URL = /\/login/;

/**
 * Coleta as chamadas de server function (`/_serverFn/*`). Em produção cada uma
 * é um round-trip browser → função da Vercel → API — elas não podem acontecer
 * a cada hover/clique dentro do app.
 */
function collectServerFnCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/_serverFn")) {
      calls.push(req.url());
    }
  });
  return calls;
}

test("hover e navegação dentro do app não chamam server functions", async ({
  page,
}) => {
  await page.clock.install();
  await signup(page);
  const { id } = await seedContract(page.request);
  const calls = collectServerFnCalls(page);
  const nav = page.locator("#app-shell nav").first();

  // hover dispara o preload por intent do router
  for (const name of ["Contratos", "Agora"]) {
    await nav.getByRole("link", { name }).hover();
  }
  await nav.getByRole("link", { name: "Contratos" }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
  // uso real: o preloadStaleTime (30s) expira e o preload reexecuta os loaders.
  // Only Date.now moves: what ages is what the router and the queries compare
  // with it. A fastForward would also fire, inside the jump, the 15 s timeout
  // of every read started meanwhile, which no real wait aborts.
  await advanceDateNow(page, 60_000);
  await page.getByRole("link", { name: "Novo contrato" }).hover();
  const row = page.locator(`a[href="/contracts/${id}"]`).first();
  await row.hover();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}`));
  // The bell opens a panel in place: no route, no loader, no server function.
  await openNotifications(page);
  await page.keyboard.press("Escape");
  await nav.getByRole("link", { name: "Agora" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();

  // preload antigo (stale) reaproveitado no clique reexecuta loaders do root/_app
  for (const name of ["Contratos", "Agora"]) {
    await nav.getByRole("link", { name }).hover();
  }
  await advanceDateNow(page, 60_000);
  const contractsReads: string[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "GET" &&
      new URL(req.url()).pathname === "/api/contracts"
    ) {
      contractsReads.push(req.url());
    }
  });
  await nav.getByRole("link", { name: "Contratos" }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
  // The 60 s did age the data: going back reads the list again, through the
  // API and never through a server function.
  await expect.poll(() => contractsReads.length).toBeGreaterThan(0);

  expect(calls).toEqual([]);
});

test("sessão perdida no meio do uso: a próxima request 401 leva ao login", async ({
  page,
}) => {
  await signup(page);
  await page.context().clearCookies();

  // navegação client-side para uma tela ainda não carregada → API responde 401
  await page
    .locator("#app-shell nav")
    .first()
    .getByRole("link", { name: "Contratos" })
    .click();
  await page.waitForURL(LOGIN_URL);
  await expect(page).toHaveURL(LOGIN_URL);
});
