import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const CONTRACTS_URL = /\/contracts$/;

test("colapsar/expandir a sidebar: nav continua acessível, persiste via cookie e sobrevive ao reload sem flash", async ({
  page,
}) => {
  await signup(page);

  // Default: expandida
  await expect(
    page.locator('#app-shell[data-sidebar="expanded"]')
  ).toBeVisible();

  // Colapsa
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(
    page.locator('#app-shell[data-sidebar="collapsed"]')
  ).toBeVisible();

  // Nav continua navegável colapsada (accessible name via span sr-only)
  await page.getByRole("link", { name: "Contratos" }).click();
  await expect(page).toHaveURL(CONTRACTS_URL);

  // Cookie persiste o estado colapsado
  await expect
    .poll(() =>
      page
        .context()
        .cookies()
        .then((cs) => cs.find((c) => c.name === "sidebar")?.value)
    )
    .toBe("collapsed");

  // Reload: SSR lê o cookie e já renderiza colapsada no 1º paint (sem flash).
  await page.reload();
  await waitForHydrated(page);
  await expect(
    page.locator('#app-shell[data-sidebar="collapsed"]')
  ).toBeVisible();

  // Sign-out continua alcançável mesmo com a rail colapsada
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

  // Expande de volta
  await page.getByRole("button", { name: "Expandir menu" }).click();
  await expect(
    page.locator('#app-shell[data-sidebar="expanded"]')
  ).toBeVisible();
});

test("sidebar colapsada não tem violações de a11y", async ({ page }) => {
  await signup(page);
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(
    page.locator('#app-shell[data-sidebar="collapsed"]')
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
});
