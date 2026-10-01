import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";

test("sem a chave global, Conta não mostra lembretes por e-mail", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/settings");
  await waitForHydrated(page);
  await expect(
    page.getByRole("heading", { name: "Conta", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Lembretes por e-mail")).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});
