import { expect, test } from "@playwright/test";
import { seedContract, signup } from "../fixtures";

const TO_PAY_VALUE = /3\.000,00|R\$/;

test("criar contrato (auto) aparece na lista e reflete no dashboard", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/contracts/new");

  // Passo 1 — básico (ownerRole já é "buyer" por padrão)
  await page.locator("#title").fill("Aluguel E2E");
  await page.getByRole("button", { name: "Avançar" }).click();

  // Passo 2 — auto (firstDueDate é obrigatório)
  await page.locator("#total").fill("3.000,00");
  await page.locator("#count").fill("3");
  await page.locator("#first").fill("10/09/2026");
  await page.getByRole("button", { name: "Criar contrato" }).click();

  // detalhe do contrato
  await expect(
    page.getByRole("heading", { name: "Aluguel E2E" })
  ).toBeVisible();

  // aparece na lista
  await page.goto("/contracts");
  await expect(page.getByText("Aluguel E2E")).toBeVisible();

  // reflete no dashboard
  await page.goto("/");
  await expect(page.getByTestId("stat-to-pay")).toContainText(TO_PAY_VALUE);
});

test("wizard bloqueia título vazio", async ({ page }) => {
  await signup(page);
  await page.goto("/contracts/new");
  await page.getByRole("button", { name: "Avançar" }).click();
  // permanece no passo 1: o título segue visível e o campo de passo 2 não existe
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#total")).toHaveCount(0);
});

test("excluir contrato remove da lista", async ({ page }) => {
  await signup(page);
  const { id } = await seedContract(page.request, { title: "Para excluir" });
  await page.goto(`/contracts/${id}`);
  await page.getByRole("button", { name: "Ações do contrato" }).click();
  await page.getByRole("menuitem", { name: "Excluir contrato" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.waitForURL("**/contracts");
  await expect(page.getByText("Para excluir")).toHaveCount(0);
});
