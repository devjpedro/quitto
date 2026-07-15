import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { getContract, seedContract, signup } from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test("login não tem violações de a11y", async ({ page }) => {
  await page.goto("/login");
  await scan(page);
});

test("rotas autenticadas não têm violações de a11y", async ({ page }) => {
  await signup(page);
  await scan(page); // dashboard vazio

  const { id } = await seedContract(page.request);
  await page.goto("/contracts");
  await scan(page);
  await page.goto("/contracts/new");
  await scan(page);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  // drawer da parcela aberto
  const detail = await getContract(page.request, id);
  await page.goto(`/contracts/${id}?installment=${detail.installments[0].id}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // O drawer abre com fade/slide-in (tw-animate-css). Sem esperar a animação
  // terminar, o axe às vezes escaneia um frame intermediário: nesse instante,
  // texto e fundo estão ambos com opacidade parcial em relação ao body, o que
  // "esbate" a cor e derruba artificialmente o contraste medido — falso
  // positivo de color-contrast que não reflete o estado final renderizado.
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
  await scan(page);

  await page.goto("/notifications");
  await scan(page);
  await page.goto("/settings");
  await scan(page);
  await page.goto("/"); // dashboard com contrato
  await scan(page);
});
