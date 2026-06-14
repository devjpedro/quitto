import { expect, test } from "@playwright/test";

const LOGIN_HEADING = /Entre na sua conta/i;

test("a página de login carrega", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: LOGIN_HEADING })
  ).toBeVisible();
});
