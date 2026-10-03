import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";

const FAIL = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({
    error: { code: "INTERNAL", message: "falha simulada" },
  }),
};

test("loader que falha mostra a fronteira de erro (não tela branca)", async ({
  page,
}) => {
  await signup(page);
  // The contracts list is fetched in the browser: page.route reaches it.
  await page.route("**/api/contracts", (route) => route.fulfill(FAIL));
  await page.goto("/contracts");
  await expect(page.getByText("Ops, algo deu errado")).toBeVisible({
    timeout: 15_000,
  });
});

test("Agora com o /api/home falhando: o erro fica só na seção", async ({
  page,
}) => {
  await signup(page);
  await page.route("**/api/home", (route) => route.fulfill(FAIL));
  await page.goto("/contracts");
  await waitForHydrated(page);
  await page
    .locator("#app-shell nav")
    .filter({ visible: true })
    .first()
    .getByRole("link", { name: "Agora" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
});
