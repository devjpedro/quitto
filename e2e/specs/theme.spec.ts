import { expect, test } from "@playwright/test";
import { signup } from "../fixtures";

test("toggle de tema persiste via cookie e aplica classe (sem flash no reload)", async ({
  page,
}) => {
  // O ThemeToggle vive no rodapé da sidebar autenticada (e em Conta);
  // não há toggle público no /login, então autentica primeiro.
  await signup(page);

  await expect(page.locator("html.dark")).toHaveCount(0);
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect(page.locator("html.dark")).toBeVisible();

  await expect
    .poll(() =>
      page
        .context()
        .cookies()
        .then((cs) => cs.find((c) => c.name === "theme")?.value)
    )
    .toBe("dark");

  // Reload: SSR lê o cookie e já renderiza .dark antes do 1º paint — sem flash.
  await page.reload();
  await expect(page.locator("html.dark")).toBeVisible();

  // Alternar de volta também persiste.
  await page.getByRole("button", { name: "Tema claro" }).click();
  await expect(page.locator("html.dark")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .context()
        .cookies()
        .then((cs) => cs.find((c) => c.name === "theme")?.value)
    )
    .toBe("light");
});
