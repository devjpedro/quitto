import { expect, test } from "@playwright/test";
import {
  brDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const MONTHLY_SUMMARY_LINE = /\/mês · 12 meses/;
// The terms, said once, in the other party's line (mockup 14).
const MONTHLY_TERMS = /R\$\s800,00 todo dia \d+ · 12 parcelas/;

test("criar contrato (auto) aparece na lista e no Agora", async ({ page }) => {
  await signup(page);
  await page.goto("/contracts/new");
  await waitForHydrated(page);

  // Passo 1 — básico (ownerRole já é "buyer" por padrão)
  await page.locator("#title").fill("Aluguel E2E");
  await page.getByRole("button", { name: "Avançar" }).click();

  // Passo 2 — auto (firstDueDate é obrigatório)
  await page.locator("#total").fill("3.000,00");
  await page.locator("#count").fill("3");
  await page.locator("#first").fill(brDaysFromToday(5));
  await page.getByRole("button", { name: "Criar contrato" }).click();

  // detalhe do contrato
  await expect(
    page.getByRole("heading", { name: "Aluguel E2E" })
  ).toBeVisible();

  // aparece na lista (no main: a sidebar também lista os contratos ativos)
  await page.goto("/contracts");
  await expect(page.getByRole("main").getByText("Aluguel E2E")).toBeVisible();

  // aparece no Agora: a 1ª parcela vence em 5 dias
  await page.goto("/");
  await expect(
    page.getByRole("article", { name: "Aluguel E2E · parcela 1 de 3" })
  ).toBeVisible();
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
  // The page streams in by SSR: a click before hydration does nothing.
  await waitForHydrated(page);
  await page.getByRole("button", { name: "Ações do contrato" }).click();
  await page.getByRole("menuitem", { name: "Excluir contrato" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.waitForURL("**/contracts");
  await expect(page.getByText("Para excluir")).toHaveCount(0);
});

test("criar contrato mensal gera parcelas iguais e mostra a intenção", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/contracts/new");
  await waitForHydrated(page);

  await page.locator("#title").fill("Aluguel Mensal E2E");
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.getByRole("button", { name: "Mensal" }).click();
  await page.locator("#monthly-amount").fill("800,00");
  await page.locator("#months").fill("12");
  await page.locator("#monthly-first").fill(brDaysFromToday(10));

  // resumo mostra a intenção antes de criar
  await expect(page.getByText(MONTHLY_SUMMARY_LINE)).toBeVisible();

  await page.getByRole("button", { name: "Criar contrato" }).click();

  await expect(
    page.getByRole("heading", { name: "Aluguel Mensal E2E" })
  ).toBeVisible();
  // as condições na linha da outra parte do detalhe
  await expect(page.getByText(MONTHLY_TERMS)).toBeVisible();
});
