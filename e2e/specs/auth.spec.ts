import { expect, test } from "@playwright/test";
import {
  GREETING,
  openAccountMenu,
  randomEmail,
  scan,
  signup,
  waitForHydrated,
} from "../fixtures";
import { collectHydrationErrors } from "../home-helpers";

const LOGOUT = /Sair/i;
const SIGNIN_SUBMIT = /^Entrar$/;
/**
 * Senha errada devolve `INVALID_EMAIL_OR_PASSWORD`, que a UI traduz para esta
 * frase, a mesma de conta inexistente, de propósito (evita enumeração de
 * usuários). Ver `features/auth/lib/auth-error.ts`.
 */
const SIGNIN_FAIL = /E-mail ou senha incorretos/i;
const LOGIN_URL = /\/login/;
const LOGO_X = 22;

test("criar conta leva ao Agora", async ({ page }) => {
  await signup(page);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
});

test("entrar com a senha errada mostra a frase de credenciais", async ({
  page,
}) => {
  const email = randomEmail();
  await signup(page, email);
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await waitForHydrated(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("senhaerrada");
  await page.getByRole("button", { name: SIGNIN_SUBMIT }).click();
  await expect(page.getByRole("alert")).toHaveText(SIGNIN_FAIL);
});

test("rota protegida sem sessão volta ao alvo depois de entrar", async ({
  page,
}) => {
  const email = randomEmail();
  await signup(page, email);
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await page.goto("/contracts");
  await page.waitForURL("**/login**");
  await waitForHydrated(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: SIGNIN_SUBMIT }).click();
  await page.waitForURL("**/contracts");
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
});

test("sair volta ao login e a rota protegida pede sessão", async ({ page }) => {
  await signup(page);
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await page.goto("/contracts");
  await page.waitForURL("**/login**");
  await expect(page).toHaveURL(LOGIN_URL);
});

test("esqueci a senha: a confirmação neutra", async ({ page }) => {
  await page.goto("/login");
  await waitForHydrated(page);
  await page.getByRole("link", { name: "Esqueci a senha" }).click();
  await page.waitForURL("**/forgot-password");
  await waitForHydrated(page);
  // The route's own chunk may hydrate after the root: a click before it is a
  // native submit that reloads the page, so try again until the answer shows.
  await expect(async () => {
    await page.locator("#email").fill("ninguem@e2e.test");
    await page.getByRole("button", { name: "Mandar o link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Se ninguem@e2e.test tiver conta",
      { timeout: 2000 }
    );
  }).toPass({ timeout: 15_000 });
});

test("nova senha com link inválido oferece pedir outro", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(
    page.getByRole("heading", { name: "Este link não vale mais" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pedir outro link" })
  ).toHaveAttribute("href", "/forgot-password");
});

test("link de confirmação vencido pede outro", async ({ page }) => {
  await page.goto("/verify-email?error=TOKEN_EXPIRED");
  await expect(
    page.getByRole("heading", { name: "O link de confirmação venceu" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mandar outro link" })
  ).toBeVisible();
});

test("celular: só o formulário, com a logo no topo", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: a moldura de celular só existe no viewport de celular
  test.skip(testInfo.project.name !== "mobile", "só no viewport de celular");
  await page.goto("/login");
  await expect(page.getByTestId("wizard-form")).toBeVisible();
  const logo = page
    .getByRole("img", { name: "Quitto" })
    .filter({ visible: true })
    .first();
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox())?.y ?? 99).toBeLessThan(60);
});

test("desktop: a vitrine em Floresta com a logo no canto", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: a vitrine lateral só existe no viewport de desktop
  test.skip(testInfo.project.name === "mobile", "só no viewport de desktop");
  await page.goto("/login");
  const stage = page.getByRole("region", { name: "Quitto" });
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  expect(box?.x).toBe(12);
  const logo = stage.getByRole("img", { name: "Quitto" }).filter({
    visible: true,
  });
  const logoBox = await logo.boundingBox();
  expect(logoBox?.x ?? 0).toBeGreaterThan(LOGO_X);
});

test("sem erro de hidratação no login", async ({ page }) => {
  const errors = collectHydrationErrors(page);
  await page.goto("/login");
  await waitForHydrated(page);
  await page.goto("/login?mode=signup");
  await waitForHydrated(page);
  expect(errors).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe (${scheme}): entrar, criar conta, esqueci, nova senha e confirmar`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "theme", value: scheme, url: "http://localhost:3001" },
    ]);
    for (const path of [
      "/login",
      "/login?mode=signup",
      "/forgot-password",
      "/reset-password?error=INVALID_TOKEN",
      "/verify-email?error=TOKEN_EXPIRED",
    ]) {
      await page.goto(path);
      await waitForHydrated(page);
      await scan(page);
    }
  });
}
