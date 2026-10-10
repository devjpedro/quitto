import { expect, test } from "@playwright/test";
import { waitForHydrated } from "../fixtures";

test("o login carrega em pt-BR", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Entre na sua conta" })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test.describe("em inglês", () => {
  test.use({ locale: "en-US" });

  test("the login loads in en-US", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to your account" })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  });
});

test("trocar o idioma no login", async ({ page }) => {
  await page.goto("/login");
  await waitForHydrated(page);
  await page
    .getByRole("radio", { name: "English (US)" })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});
