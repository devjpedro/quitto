import { expect, test } from "@playwright/test";
import { API_FAILURE, nowLink, signup, waitForHydrated } from "../fixtures";

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
