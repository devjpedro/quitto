import { expect, test } from "@playwright/test";
import { API_FAILURE, nowLink, signup, waitForHydrated } from "../fixtures";

const NEW_CONTRACT_URL = /\/contracts\/new$/;

test("loader que falha mostra a fronteira de erro (não tela branca)", async ({
  page,
}) => {
  await signup(page);
  // The contracts list is fetched in the browser: page.route reaches it.
  await page.route("**/api/contracts", (route) => route.fulfill(API_FAILURE));
  await page.goto("/contracts");
  await expect(page.getByText("Ops, algo deu errado")).toBeVisible({
    timeout: 15_000,
  });
});

test("Agora com o /api/home falhando: o erro fica só na seção", async ({
  page,
}) => {
  await signup(page);
  await page.route("**/api/home", (route) => route.fulfill(API_FAILURE));
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
});

test("⌘K com o /api/contracts falhando: o erro fica na paleta e o shell segue de pé", async ({
  page,
}) => {
  await signup(page);
  await page.route("**/api/contracts", (route) => route.fulfill(API_FAILURE));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The `_app` registers ⌘K after the root hydrates: wait for the listener.
  await page
    .locator("html[data-shortcuts-ready]")
    .waitFor({ state: "attached" });
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");

  // The app retries a failed read once, a second later.
  await expect(palette.getByRole("alert")).toContainText(
    "Não foi possível carregar os contratos."
  );
  await expect(
    palette.getByRole("button", { name: "Tentar de novo" })
  ).toBeVisible();
  for (const name of [
    "Agora",
    "Contratos",
    "Conta",
    "Criar contrato",
    "Notificações",
  ]) {
    await expect(
      palette.getByRole("option", { name, exact: true })
    ).toBeVisible();
  }
  await expect(page.getByText("Ops, algo deu errado")).toHaveCount(0);

  // By keyboard: Tab from the field reaches Tentar de novo, and Enter reads
  // the list again there, without running the highlighted command (Agora).
  let retriedReads = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/contracts") {
      retriedReads += 1;
    }
  });
  await page.keyboard.press("Tab");
  await expect(
    palette.getByRole("button", { name: "Tentar de novo" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => retriedReads).toBeGreaterThan(0);
  await expect(palette).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");

  await palette
    .getByRole("option", { name: "Criar contrato", exact: true })
    .click();
  await expect(page).toHaveURL(NEW_CONTRACT_URL);
  await expect(page.getByText("Ops, algo deu errado")).toHaveCount(0);
});
