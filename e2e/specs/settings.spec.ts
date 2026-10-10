import { expect, test } from "@playwright/test";
import { scan, signup, waitForHydrated } from "../fixtures";
import { collectHydrationErrors } from "../home-helpers";

const LOGIN_URL = /\/login/;
const ENGLISH = /English \(US\)/;
const REMINDERS = /Lembretes/;
const YOUR_DATA = /Seus dados/;
const SETTINGS = /Ajustes/;
const PIX_KEY = "joao.souza@exemplo.com";

test("trocar o idioma grava na conta", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/profile");
  await waitForHydrated(page);
  await page.getByRole("radio", { name: ENGLISH }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  const me = await page.request.get("/api/me");
  expect((await me.json()).locale).toBe("en-US");
});

test("salvar, ver o tipo e remover a chave PIX", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/pix");
  await waitForHydrated(page);
  await page.getByLabel("Sua chave PIX").fill(PIX_KEY);
  await page.getByRole("button", { name: "Salvar" }).click();
  const saved = page.getByTestId("pix-saved");
  await expect(saved).toContainText(PIX_KEY);
  await expect(saved).toContainText("chave e-mail");
  await page.getByRole("button", { name: "Remover" }).click();
  await page
    .getByRole("dialog", { name: "Remover a chave PIX?" })
    .getByRole("button", { name: "Remover" })
    .click();
  await expect(page.getByLabel("Sua chave PIX")).toBeVisible();
  await expect(saved).toHaveCount(0);
});

test("o guia do Agora leva ao PIX com o foco no campo", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/pix");
  await waitForHydrated(page);
  await expect(page.getByLabel("Sua chave PIX")).toBeFocused();
});

test("sem a chave global, a seção Lembretes não aparece", async ({ page }) => {
  await signup(page);
  await page.goto("/settings");
  await waitForHydrated(page);
  await expect(page.getByRole("link", { name: REMINDERS })).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});

test("senha atual errada mostra o erro", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/security");
  await waitForHydrated(page);
  await page.getByRole("button", { name: "Trocar a senha" }).click();
  await page.locator("#current-password").fill("senha-errada-1");
  await page.locator("#new-password").fill("nova-senha-123");
  await page.locator("#confirm-password").fill("nova-senha-123");
  await page.getByRole("button", { name: "Salvar a nova senha" }).click();
  await expect(page.getByText("A senha atual não confere.")).toBeVisible();
});

test("exportar meus dados baixa o JSON", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/data");
  await waitForHydrated(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("quitto-meus-dados.json");
});

test("excluir exige a frase e leva ao login", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/data");
  await waitForHydrated(page);
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Excluir definitivamente" });
  await expect(confirm).toBeDisabled();
  await page.locator("#confirm-phrase").fill("frase errada");
  await expect(confirm).toBeDisabled();
  await page.locator("#confirm-phrase").fill("EXCLUIR");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL("**/login");
  await expect(page).toHaveURL(LOGIN_URL);
});

test("celular: a lista é a página e cada seção é uma tela", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: a lista como página só existe no viewport de celular
  test.skip(testInfo.project.name !== "mobile", "só no viewport de celular");
  await signup(page);
  await page.goto("/settings");
  await waitForHydrated(page);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await page.getByRole("link", { name: YOUR_DATA }).click();
  await page.waitForURL("**/settings/data");
  await expect(page.getByRole("link", { name: SETTINGS })).toBeVisible();
});

test("sem erro de hidratação nos Ajustes", async ({ page }) => {
  const errors = collectHydrationErrors(page);
  await signup(page);
  for (const path of [
    "/settings",
    "/settings/profile",
    "/settings/pix",
    "/settings/security",
  ]) {
    await page.goto(path);
    await waitForHydrated(page);
  }
  expect(errors).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe (${scheme}): Ajustes, com o diálogo de excluir aberto`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "theme", value: scheme, url: "http://localhost:3001" },
    ]);
    await signup(page);
    for (const section of ["profile", "pix", "security", "data"]) {
      await page.goto(`/settings/${section}`);
      await waitForHydrated(page);
      await scan(page);
    }
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan(page);
  });
}
