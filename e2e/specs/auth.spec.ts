import { expect, test } from "@playwright/test";
import { randomEmail, signup } from "../fixtures";

const LOGOUT = /Sair/i;
const SIGNIN_SUBMIT = /^Entrar$/;
const SIGNIN_FAIL = /Não foi possível entrar/i;
const LOGIN_URL = /\/login/;

test("signup leva ao dashboard", async ({ page }) => {
  await signup(page);
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
});

test("logout volta ao login e a rota protegida exige sessão", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await page.goto("/contracts");
  await page.waitForURL("**/login**"); // guard redireciona
  await expect(page).toHaveURL(LOGIN_URL);
});

test("deep-link protegido deslogado volta ao alvo após login", async ({
  page,
}) => {
  const email = randomEmail();
  await signup(page, email);
  await page.getByRole("button", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await page.goto("/contracts");
  await page.waitForURL("**/login**");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: SIGNIN_SUBMIT }).click();
  await page.waitForURL("**/contracts");
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
});

test("login com senha errada mostra erro", async ({ page }) => {
  const email = randomEmail();
  await signup(page, email);
  await page.getByRole("button", { name: LOGOUT }).click();
  await page.waitForURL("**/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("senhaerrada");
  await page.getByRole("button", { name: SIGNIN_SUBMIT }).click();
  await expect(page.getByText(SIGNIN_FAIL)).toBeVisible();
});
