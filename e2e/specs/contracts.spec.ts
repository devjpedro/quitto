import { expect, test } from "@playwright/test";
import { seedContract, signup, waitForHydrated } from "../fixtures";

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
