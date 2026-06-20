import { expect, test } from "@playwright/test";

const LINK_NAME = /voltar ao início/i;
const LOGIN_URL = /\/login/;

test("rota inexistente mostra o 404 de marca (sem tela branca)", async ({
  page,
}) => {
  await page.goto("/rota-que-nao-existe");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await page.getByRole("link", { name: LINK_NAME }).click();
  // deslogado: home redireciona ao login (com query ?redirect=/)
  await page.waitForURL(LOGIN_URL);
});
