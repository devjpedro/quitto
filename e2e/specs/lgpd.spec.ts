import { expect, test } from "@playwright/test";
import { seedContract, signup } from "../fixtures";

const LOGIN_URL = /\/login/;

test("exportar meus dados baixa o JSON", async ({ page }) => {
  await signup(page);
  await seedContract(page.request, { title: "Para exportar" }); // usuário com 1 contrato
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar meus dados" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("quitto-meus-dados.json");
});

test("excluir conta exige a frase e leva ao login", async ({ page }) => {
  await signup(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Excluir conta" }).click();
  const confirmBtn = page.getByRole("button", {
    name: "Excluir definitivamente",
  });
  await expect(confirmBtn).toBeDisabled();
  await page.locator("#confirm-phrase").fill("frase errada");
  await expect(confirmBtn).toBeDisabled();
  await page.locator("#confirm-phrase").fill("EXCLUIR");
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();
  await page.waitForURL("**/login");
  await expect(page).toHaveURL(LOGIN_URL);
});
