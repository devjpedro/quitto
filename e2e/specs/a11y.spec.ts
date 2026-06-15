import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { getContract, seedContract, signup } from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test("login não tem violações de a11y", async ({ page }) => {
  await page.goto("/login");
  await scan(page);
});

test("rotas autenticadas não têm violações de a11y", async ({ page }) => {
  await signup(page);
  await scan(page); // dashboard vazio

  const { id } = await seedContract(page.request);
  await page.goto("/contracts");
  await scan(page);
  await page.goto("/contracts/new");
  await scan(page);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  // drawer da parcela aberto
  const detail = await getContract(page.request, id);
  await page.goto(`/contracts/${id}?installment=${detail.installments[0].id}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan(page);

  await page.goto("/notifications");
  await scan(page);
  await page.goto("/settings");
  await scan(page);
  await page.goto("/"); // dashboard com contrato
  await scan(page);
});
