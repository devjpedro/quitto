import { expect, test } from "@playwright/test";
import { seedContract, signup } from "../fixtures";

const NEW_CONTRACT_URL = /\/contracts\/new/;
const UPCOMING_TITLE = /Dashboard E2E/i;

test("empty state aparece e leva ao novo contrato", async ({ page }) => {
  await signup(page); // usuário novo, sem contratos
  await page.goto("/");
  await expect(page.getByTestId("dashboard-empty-state")).toBeVisible();
  await page.getByRole("link", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(NEW_CONTRACT_URL);
});

test("stats refletem o contrato e a próxima parcela abre o drawer", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Dashboard E2E" });
  await page.goto("/");
  // Contratos ativos = 1
  await expect(page.getByTestId("stat-active")).toContainText("1");
  // próximas parcelas lista o contrato; abrir uma abre o drawer
  await expect(
    page.getByRole("heading", { name: "Próximas parcelas" })
  ).toBeVisible();
  await page.getByRole("button", { name: UPCOMING_TITLE }).first().click();
  await expect(page.getByLabel("Parcela")).toBeVisible();
});
